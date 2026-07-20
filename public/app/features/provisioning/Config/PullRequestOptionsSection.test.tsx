import { useForm } from 'react-hook-form';
import { act, render, screen } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { type RepoType } from '../Wizard/types';
import { setupProvisioningMswServer } from '../mocks/server';
import { type RepositoryFormData } from '../types';

import { PullRequestOptionsSection } from './PullRequestOptionsSection';

// PullRequestOptionsSection calls useGetFrontendSettingsQuery; the request is
// served by the default provisioning MSW handlers.
setupProvisioningMswServer();

interface WrapperProps {
  repoType?: RepoType;
  dashboardPreviewName?: 'generateDashboardPreviews';
}

function Wrapper({ repoType, dashboardPreviewName }: WrapperProps = {}) {
  const { register } = useForm<RepositoryFormData>();
  return (
    <PullRequestOptionsSection<RepositoryFormData>
      register={register}
      titleTemplateName="pullRequest.titleTemplate"
      enforceTemplateName="pullRequest.enforceTemplate"
      repoType={repoType}
      dashboardPreviewName={dashboardPreviewName}
    />
  );
}

describe('PullRequestOptionsSection', () => {
  beforeEach(() => {
    // Default to the gitConventions flag being enabled; specific tests override.
    setTestFlags({ 'provisioning.gitConventions': true });
  });

  afterEach(async () => {
    // setTestFlags fires OpenFeature events that update mounted components, so reset within act().
    await act(async () => {
      setTestFlags({});
    });
  });

  it('renders nothing when the gitConventions flag is off', () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    const { container } = render(<Wrapper />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders collapsed by default, hiding the inner fields', () => {
    render(<Wrapper />);

    expect(screen.getByText('Pull request options')).toBeInTheDocument();
    // Collapse renders its children only when open
    expect(screen.queryByText('Pull request title template')).not.toBeInTheDocument();
  });

  it('reveals the title template and enforcement fields when expanded', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Pull request options'));

    expect(screen.getByText('Pull request title template')).toBeInTheDocument();
    expect(screen.getByText('Enforce pull request title template')).toBeInTheDocument();
  });

  it('registers the inputs under the provided spec paths', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Pull request options'));

    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'pullRequest.titleTemplate');
    expect(screen.getByRole('checkbox')).toHaveAttribute('name', 'pullRequest.enforceTemplate');
  });

  it('renders the dashboard previews toggle for GitHub even when the gitConventions flag is off', async () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    const { user } = render(<Wrapper repoType="github" dashboardPreviewName="generateDashboardPreviews" />);

    await user.click(screen.getByText('Pull request options'));

    expect(screen.getByRole('checkbox', { name: /Enable dashboard previews in pull requests/i })).toBeInTheDocument();
    // Template fields stay hidden while the flag is off.
    expect(screen.queryByText('Pull request title template')).not.toBeInTheDocument();
  });

  it('renders the dashboard previews toggle for GitHub Enterprise even when the gitConventions flag is off', async () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    const { user } = render(<Wrapper repoType="githubEnterprise" dashboardPreviewName="generateDashboardPreviews" />);

    await user.click(screen.getByText('Pull request options'));

    expect(screen.getByRole('checkbox', { name: /Enable dashboard previews in pull requests/i })).toBeInTheDocument();
    // Template fields stay hidden while the flag is off.
    expect(screen.queryByText('Pull request title template')).not.toBeInTheDocument();
  });

  it('does not render the dashboard previews toggle for non-GitHub providers', () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    const { container } = render(<Wrapper repoType="gitlab" dashboardPreviewName="generateDashboardPreviews" />);

    expect(container).toBeEmptyDOMElement();
  });
});
