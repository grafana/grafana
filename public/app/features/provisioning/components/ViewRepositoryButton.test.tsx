import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { config, reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { ViewRepositoryButton } from './ViewRepositoryButton';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('ViewRepositoryButton', () => {
  const originalProvisioningToggle = config.featureToggles.provisioning;

  beforeEach(() => {
    config.featureToggles.provisioning = true;
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action: string) => action === AccessControlAction.ProvisioningRepositoriesRead);
  });

  afterEach(() => {
    config.featureToggles.provisioning = originalProvisioningToggle;
    jest.restoreAllMocks();
  });

  it('renders a link to the repository view when permitted and repositoryName is set', () => {
    render(<ViewRepositoryButton repositoryName="my-repo" />);

    const link = screen.getByRole('link', { name: 'View repository' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/provisioning/my-repo');
  });

  it('reports an interaction when the repository link is clicked', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<ViewRepositoryButton repositoryName="my-repo" />);
    // Stop jsdom from attempting real navigation (which logs an unhandled error) while still letting
    // the onClick handler run.
    baseElement.addEventListener('click', (e) => e.preventDefault());

    await user.click(screen.getByRole('link', { name: 'View repository' }));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_provisioning_view_repository_clicked', {
      repositoryName: 'my-repo',
    });
  });

  it('renders the label as visible text when showLabel is set', () => {
    render(<ViewRepositoryButton repositoryName="my-repo" showLabel />);

    const link = screen.getByRole('link', { name: 'View repository' });
    expect(link).toHaveTextContent('View repository');
  });

  it('encodes the repository name in the URL', () => {
    render(<ViewRepositoryButton repositoryName="my repo/with special" />);

    const link = screen.getByRole('link', { name: 'View repository' });
    expect(link).toHaveAttribute('href', '/admin/provisioning/my%20repo%2Fwith%20special');
  });

  it('renders nothing when the provisioning feature toggle is off', () => {
    config.featureToggles.provisioning = false;

    render(<ViewRepositoryButton repositoryName="my-repo" />);

    expect(screen.queryByRole('link', { name: 'View repository' })).not.toBeInTheDocument();
  });

  it('renders nothing without provisioning.repositories:read permission', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    render(<ViewRepositoryButton repositoryName="my-repo" />);

    expect(screen.queryByRole('link', { name: 'View repository' })).not.toBeInTheDocument();
  });

  it('renders nothing when the resource is orphaned', () => {
    render(<ViewRepositoryButton repositoryName="my-repo" isOrphaned />);

    expect(screen.queryByRole('link', { name: 'View repository' })).not.toBeInTheDocument();
  });

  it('renders nothing without a repositoryName', () => {
    render(<ViewRepositoryButton />);

    expect(screen.queryByRole('link', { name: 'View repository' })).not.toBeInTheDocument();
  });
});
