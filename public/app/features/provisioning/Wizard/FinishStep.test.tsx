import { type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { act, render, screen } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { setupProvisioningMswServer } from '../mocks/server';

import { FinishStep } from './FinishStep';
import { StepStatusProvider } from './StepStatusContext';
import { type RepoType, type WizardFormData } from './types';

// The image-rendering / public-access checks read global config; stub them so
// the GitHub-only previews field stays out of the way of these assertions.
jest.mock('../GettingStarted/features', () => ({
  checkPublicAccess: jest.fn().mockReturnValue(false),
  checkImageRenderer: jest.fn().mockReturnValue(false),
  checkImageRenderingAllowed: jest.fn().mockReturnValue(false),
}));

// The frontend-settings request is served by the default provisioning MSW handlers.
setupProvisioningMswServer();

const BRANCH_LABEL = 'Branch options';
const COMMIT_LABEL = 'Commit options';
const PR_LABEL = 'Pull request options';

function FormWrapper({ children, type }: { children: ReactNode; type: RepoType }) {
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: {
        type,
        url: 'https://example.com/repo.git',
        title: '',
        sync: { target: 'folder', enabled: true },
        branch: 'main',
        path: '',
        readOnly: false,
        prWorkflow: false,
      },
    },
  });

  return (
    <FormProvider {...methods}>
      <StepStatusProvider>{children}</StepStatusProvider>
    </FormProvider>
  );
}

function setup(type: RepoType) {
  return render(
    <FormWrapper type={type}>
      <FinishStep />
    </FormWrapper>
  );
}

describe('FinishStep', () => {
  beforeEach(() => {
    setTestFlags({ 'provisioning.gitConventions': true });
  });

  afterEach(async () => {
    // setTestFlags fires OpenFeature events that update mounted components, so reset within act().
    await act(async () => {
      setTestFlags({});
    });
  });

  describe('with the gitConventions flag enabled', () => {
    it('shows branch, commit and pull request options for a GitHub repository', async () => {
      setup('github');

      expect(await screen.findByText(BRANCH_LABEL)).toBeInTheDocument();
      expect(screen.getByText(COMMIT_LABEL)).toBeInTheDocument();
      expect(screen.getByText(PR_LABEL)).toBeInTheDocument();
    });

    it('hides the pull request options for the pure git type', async () => {
      setup('git');

      expect(await screen.findByText(BRANCH_LABEL)).toBeInTheDocument();
      expect(screen.getByText(COMMIT_LABEL)).toBeInTheDocument();
      // Pure git has no pull/merge request platform.
      expect(screen.queryByText(PR_LABEL)).not.toBeInTheDocument();
    });

    it('shows no git convention sections for a non-git repository', async () => {
      setup('local');

      // "Read only" always renders; wait for it so the component has settled.
      expect(await screen.findByText('Read only')).toBeInTheDocument();
      expect(screen.queryByText(BRANCH_LABEL)).not.toBeInTheDocument();
      expect(screen.queryByText(COMMIT_LABEL)).not.toBeInTheDocument();
      expect(screen.queryByText(PR_LABEL)).not.toBeInTheDocument();
    });

    it('shows the webhook section for a GitHub repository', async () => {
      setup('github');

      expect(await screen.findByText('Webhook options')).toBeInTheDocument();
    });

    it('shows the webhook section for a GitLab repository', async () => {
      setup('gitlab');

      expect(await screen.findByText('Webhook options')).toBeInTheDocument();
    });

    it('does not show the webhook section for a git provider without webhooks', async () => {
      setup('bitbucket');

      expect(await screen.findByText(PR_LABEL)).toBeInTheDocument();
      expect(screen.queryByText('Webhook options')).not.toBeInTheDocument();
    });
  });

  describe('with the gitConventions flag disabled', () => {
    beforeEach(() => {
      setTestFlags({ 'provisioning.gitConventions': false });
    });

    it('hides the branch and pull request sections but keeps commit options', async () => {
      setup('github');

      // The commit message template stays available; only the enforce option is gated.
      expect(await screen.findByText(COMMIT_LABEL)).toBeInTheDocument();
      expect(screen.queryByText(BRANCH_LABEL)).not.toBeInTheDocument();
      expect(screen.queryByText(PR_LABEL)).not.toBeInTheDocument();
    });
  });

  describe('commit signing', () => {
    it('renders the signing method selector for github with signing off by default', async () => {
      const { user } = setup('github');

      await user.click(await screen.findByText(COMMIT_LABEL));

      expect(screen.getByText('Commit signing')).toBeInTheDocument();
      expect(screen.queryByLabelText(/Signing key/)).not.toBeInTheDocument();
    });

    it('reveals signing key and author fields after a method is selected', async () => {
      const { user } = setup('github');

      await user.click(await screen.findByText(COMMIT_LABEL));
      await user.click(screen.getByLabelText('GPG'));

      expect(screen.getByLabelText(/Signing key/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Signer name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Signer email/)).toBeInTheDocument();
    });

    it('shows the S/MIME certificate field only for the smime method', async () => {
      const { user } = setup('github');

      await user.click(await screen.findByText(COMMIT_LABEL));
      await user.click(screen.getByLabelText('GPG'));
      expect(screen.queryByLabelText(/S\/MIME certificate/)).not.toBeInTheDocument();

      await user.click(screen.getByLabelText('S/MIME'));
      expect(screen.getByLabelText(/S\/MIME certificate/)).toBeInTheDocument();
    });

    it('does not render the signing section for local repositories', async () => {
      setup('local');

      expect(await screen.findByText('Read only')).toBeInTheDocument();
      expect(screen.queryByText('Commit signing')).not.toBeInTheDocument();
    });
  });
});
