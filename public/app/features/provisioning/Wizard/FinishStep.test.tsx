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

const BRANCH_LABEL = 'Branch options (advanced)';
const COMMIT_LABEL = 'Commit options (advanced)';
const PR_LABEL = 'Pull request options (advanced)';

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
});
