import { QueryStatus } from '@reduxjs/toolkit/query';
import { screen } from '@testing-library/react';
import { type UserEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { act, render, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { useCreateOrUpdateRepository } from '../hooks/useCreateOrUpdateRepository';
import { createJob, createRepository } from '../mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from '../mocks/server';

import { ProvisioningWizard } from './ProvisioningWizard';
import { StepStatusProvider } from './StepStatusContext';

setupProvisioningMswServer();

const mockNavigate = jest.fn();

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

// Keep useCreateOrUpdateRepository as jest.mock — it orchestrates a multi-step
// test→create/update flow and the error tests need fine-grained call-by-call control.
jest.mock('../hooks/useCreateOrUpdateRepository');

const mockUseCreateOrUpdateRepository = useCreateOrUpdateRepository as jest.MockedFunction<
  typeof useCreateOrUpdateRepository
>;

function setup(jsx: JSX.Element) {
  return render(<StepStatusProvider>{jsx}</StepStatusProvider>);
}

async function pasteIntoInput(user: UserEvent, input: HTMLElement, value: string) {
  await user.click(input);
  await user.clear(input);
  await user.paste(value);
}

async function typeIntoTokenField(user: UserEvent, placeholder: string, value: string) {
  await pasteIntoInput(user, screen.getByPlaceholderText(placeholder), value);
}

async function navigateToConnectionStep(
  user: UserEvent,
  type: 'github' | 'gitlab' | 'bitbucket' | 'local' | 'git',
  data?: {
    token?: string;
    tokenUser?: string;
    url?: string;
  }
) {
  if (type === 'github') {
    // Select PAT option (GitHub App is the default)
    await user.click(screen.getByLabelText(/Connect with Personal Access Token/i));
  }

  if (type !== 'local' && data?.token) {
    const tokenPlaceholders = {
      github: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      gitlab: 'glpat-xxxxxxxxxxxxxxxxxxx',
      bitbucket: 'ATATTxxxxxxxxxxxxxxxx',
      git: 'token or password',
    };
    await typeIntoTokenField(user, tokenPlaceholders[type], data.token);
  }

  if ((type === 'bitbucket' || type === 'git') && data?.tokenUser) {
    await pasteIntoInput(user, screen.getByPlaceholderText('username'), data.tokenUser);
  }

  if (type !== 'local' && data?.url) {
    await pasteIntoInput(user, screen.getByRole('textbox', { name: /Repository URL/i }), data.url);
  }

  if (type !== 'local') {
    await user.click(screen.getByRole('button', { name: /Configure repository$/i }));
  }
  // For local, the wizard starts on the connection step (authType is pre-completed), so no click needed

  if (type === 'local') {
    expect(await screen.findByRole('heading', { name: /Connect to external storage/i })).toBeInTheDocument();
  } else {
    expect(await screen.findByRole('heading', { name: /Configure repository/i })).toBeInTheDocument();
  }
}

async function fillConnectionForm(
  user: UserEvent,
  type: 'github' | 'gitlab' | 'bitbucket' | 'local' | 'git',
  data: {
    token?: string;
    tokenUser?: string;
    url?: string;
    branch?: string;
    path?: string;
  }
) {
  // Complete authType step first (token/url inputs are here for all git providers)
  await navigateToConnectionStep(user, type, {
    token: data.token,
    tokenUser: data.tokenUser,
    url: data.url,
  });

  if (type !== 'local' && data.branch) {
    // Index-based: Combobox uses downshift-generated IDs so Field's htmlFor
    // doesn't associate and getByRole({ name }) can't match the label.
    const branchCombobox = screen.getAllByRole('combobox')[0];
    await user.click(branchCombobox);
    await user.clear(branchCombobox);
    await user.paste(data.branch);
    await user.keyboard('{Enter}');
  }

  if (data.path) {
    if (type === 'local') {
      await pasteIntoInput(user, screen.getByRole('textbox', { name: /Path/i }), data.path);
    } else {
      const pathCombobox = screen.getAllByRole('combobox')[1];
      await user.click(pathCombobox);
      await user.clear(pathCombobox);
      await user.paste(data.path);
      await user.keyboard('{Enter}');
    }
  }
}

function setupMockSubmitData() {
  const mockSubmitData = jest.fn();
  const mockMutationState = {
    status: QueryStatus.uninitialized,
    isLoading: false,
    error: null,
    data: undefined,
    isUninitialized: true,
    isSuccess: false,
    isError: false,
    reset: jest.fn(),
  };
  (mockUseCreateOrUpdateRepository as jest.Mock).mockReturnValue([
    mockSubmitData,
    mockMutationState,
    mockMutationState,
  ]);

  mockSubmitData.mockResolvedValue({
    data: {
      metadata: {
        name: 'test-repo-abc123',
      },
      spec: {
        type: 'github',
        title: 'Test Repository',
      },
    },
  });

  return mockSubmitData;
}

function enableSynchronizationStep() {
  server.use(
    http.get(`${BASE}/stats`, () => HttpResponse.json({ instance: [{ group: 'dashboard.grafana.app', count: 1 }] })),
    http.get(`${BASE}/repositories/:name/files/`, () =>
      HttpResponse.json({ items: [{ name: 'test.json', path: 'test.json' }] })
    )
  );
}

function mockRepositoryList(repository: Repository = createRepository()) {
  server.use(
    http.get(`${BASE}/repositories`, () =>
      HttpResponse.json({
        items: [repository],
        metadata: { resourceVersion: '1' },
      })
    )
  );
}

function mockSyncRepositoryLookup(repository: Repository = createRepository()) {
  server.use(http.get(`${BASE}/repositories/:name`, () => HttpResponse.json(repository)));
}

async function navigateToBootstrapStep(user: UserEvent) {
  enableSynchronizationStep();

  await fillConnectionForm(user, 'github', {
    token: 'test-token',
    url: 'https://github.com/test/repo',
    branch: 'main',
  });

  await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));
  expect(await screen.findByRole('heading', { name: /3\. Choose what to synchronize/i })).toBeInTheDocument();
}

async function navigateToSynchronizationStep(user: UserEvent) {
  await navigateToBootstrapStep(user);
  await user.click(screen.getByRole('button', { name: /Synchronize with external storage/i }));
  expect(await screen.findByRole('heading', { name: /4\. Synchronize with external storage/i })).toBeInTheDocument();
}

function setupWorkingJobHandlers() {
  const createdJob = createJob({ status: { state: 'pending' } });
  const workingJob = createJob();
  server.use(
    http.post(`${BASE}/repositories/:name/jobs`, () => HttpResponse.json(createdJob)),
    http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [workingJob], metadata: { resourceVersion: '1' } }))
  );
  return { createdJob, workingJob };
}

async function beginSynchronization(user: UserEvent) {
  await navigateToSynchronizationStep(user);
  const finishButton = screen.getByRole('button', { name: /Choose additional settings/i });
  await user.click(screen.getByRole('button', { name: /Begin synchronization/i }));
  expect(await screen.findByText('Pulling...')).toBeInTheDocument();
  return { finishButton };
}

describe('ProvisioningWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockSubmitData();
  });

  describe('Happy Path', () => {
    it('should render choose auth type step initially for GitHub', async () => {
      setup(<ProvisioningWizard type="github" />);

      // Wait for async operations (useConnectionOptions fetches) to settle
      expect(await screen.findByRole('heading', { name: /Connect/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Connect with Personal Access Token/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Connect with GitHub App/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Configure repository$/i })).toBeInTheDocument();
    });

    it('should render connection step after selecting auth type', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      // Select PAT option
      await user.click(screen.getByLabelText(/Connect with Personal Access Token/i));

      // Fill required fields on authType step
      await typeIntoTokenField(user, 'ghp_xxxxxxxxxxxxxxxxxxxx', 'ghp_testtoken');
      await pasteIntoInput(
        user,
        screen.getByRole('textbox', { name: /Repository URL/i }),
        'https://github.com/test/repo'
      );

      // Proceed to next step
      await user.click(screen.getByRole('button', { name: /Configure repository$/i }));

      // Verify connection step
      expect(await screen.findByRole('heading', { name: /Configure repository/i })).toBeInTheDocument();
    });

    it('should skip sync step when there are no resources', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      expect(await screen.findByRole('heading', { name: /3\. Choose what to synchronize/i })).toBeInTheDocument();

      // Should show "Choose additional settings" button instead of "Synchronize with external storage"
      expect(screen.getByRole('button', { name: /Choose additional settings/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Synchronize with external storage/i })).not.toBeInTheDocument();

      // Verify that the sync step (step 3) would be skipped in the button text logic
      const nextButton = screen.getByRole('button', { name: /Choose additional settings/i });
      expect(nextButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show field errors when connection test fails with TestResults error', async () => {
      const mockSubmitData = setupMockSubmitData();

      const testResultsError = {
        data: {
          kind: 'TestResults',
          apiVersion: 'provisioning.grafana.app/v0alpha1',
          success: false,
          code: 400,
          errors: [
            {
              type: 'FieldValueInvalid',
              field: 'spec.github.branch',
              detail: 'Branch "invalid-branch" not found',
            },
          ],
        },
        status: 400,
      };

      // First submit (authType) succeeds, second (connection step) fails
      mockSubmitData
        .mockResolvedValueOnce({ data: { metadata: { name: 'test-repo-abc123' } } })
        .mockRejectedValueOnce(testResultsError);

      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
        branch: 'invalid-branch',
      });

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      const errors = await screen.findAllByText('Branch "invalid-branch" not found');

      // Inline error is the one with role="alert"
      const inlineError = errors.find((el) => el.getAttribute('role') === 'alert');
      expect(inlineError).toBeTruthy();

      // Still on connection step (now step 2)
      expect(screen.getByRole('heading', { name: /2\. Configure repository/i })).toBeInTheDocument();
    });

    it('should allow retry after non-field error on connection step', async () => {
      const mockSubmitData = setupMockSubmitData();

      const urlError = {
        data: {
          kind: 'TestResults',
          apiVersion: 'provisioning.grafana.app/v0alpha1',
          success: false,
          code: 400,
          errors: [
            {
              type: 'FieldValueInvalid',
              field: 'spec.github.url',
              detail: 'Invalid repository URL',
            },
          ],
        },
        status: 400,
      };

      // authType succeeds → connection fails with URL error → retry succeeds
      mockSubmitData
        .mockResolvedValueOnce({ data: { metadata: { name: 'test-repo-abc123' } } })
        .mockRejectedValueOnce(urlError)
        .mockResolvedValueOnce({ data: { metadata: { name: 'test-repo-abc123' } } });

      const { user } = setup(<ProvisioningWizard type="github" />);

      await fillConnectionForm(user, 'github', {
        token: 'test-token',
        url: 'https://github.com/test/repo',
      });

      // First connection attempt — fails with URL error (field not on this step)
      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Error banner is shown
      expect(await screen.findByRole('alert', { name: /Repository connection failed/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /2\. Configure repository/i })).toBeInTheDocument();

      // User edits a visible field (branch)
      const branchCombobox = screen.getAllByRole('combobox')[0];
      await user.clear(branchCombobox);
      await user.paste('develop');
      await user.keyboard('{Enter}');

      // Retry — should not be silently blocked
      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Submit was called 3 times: 1 authType + 2 connection attempts
      expect(mockSubmitData).toHaveBeenCalledTimes(3);

      // Wizard advances to next step — proves no silent block
      expect(await screen.findByRole('heading', { name: /3\. Choose what to synchronize/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields on connection step', async () => {
      const { user } = setup(<ProvisioningWizard type="github" />);

      // Select PAT option (GitHub App is the default)
      await user.click(screen.getByLabelText(/Connect with Personal Access Token/i));

      await typeIntoTokenField(user, 'ghp_xxxxxxxxxxxxxxxxxxxx', 'test-token');
      await pasteIntoInput(
        user,
        screen.getByRole('textbox', { name: /Repository URL/i }),
        'https://github.com/test/repo'
      );

      await user.click(screen.getByRole('button', { name: /Configure repository$/i }));
      expect(await screen.findByRole('heading', { name: /2\. Configure repository/i })).toBeInTheDocument();

      const clearButtons = screen.getAllByTitle(/Clear value/i);
      await user.click(clearButtons[0]); // Clear the branch combobox

      await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

      // Should still be on connection step due to validation
      expect(screen.getByRole('heading', { name: /2\. Configure repository/i })).toBeInTheDocument();
      expect(screen.getByText(/Branch is required/i)).toBeInTheDocument();
    });
  });

  describe('Repository Reconciliation', () => {
    it('shows loading while waiting for reconciliation, then shows bootstrap content after a healthy watch event', async () => {
      mockRepositoryList(
        createRepository({
          status: {
            observedGeneration: undefined,
          },
        })
      );

      const { user } = setup(<ProvisioningWizard type="github" />);

      await navigateToBootstrapStep(user);

      expect(screen.getByText('Loading resource information...')).toBeInTheDocument();

      act(() => {
        getMockLiveSrv().emitWatchEvent('repositories', {
          type: 'MODIFIED',
          object: createRepository(),
        });
      });

      expect(await screen.findByText('Sync external storage to a new Grafana folder')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText('Loading resource information...')).not.toBeInTheDocument();
      });
    });

    it('shows an unhealthy repository error and clears it after retry plus a healthy watch event', async () => {
      mockRepositoryList(
        createRepository({
          status: {
            observedGeneration: 1,
            health: {
              healthy: false,
              checked: 1704067200000,
              message: ['Connection failed'],
            },
          },
        })
      );

      const { user } = setup(<ProvisioningWizard type="github" />);

      await navigateToBootstrapStep(user);

      expect(await screen.findByText('Repository status unhealthy')).toBeInTheDocument();

      // Retry is rendered via Alert's buttonContent/onRemove, not as a standard named button
      const retryButton = (await screen.findByText('Retry')).closest('button');
      expect(retryButton).not.toBeNull();
      await user.click(retryButton!);

      act(() => {
        getMockLiveSrv().emitWatchEvent('repositories', {
          type: 'MODIFIED',
          object: createRepository(),
        });
      });

      expect(await screen.findByText('Sync external storage to a new Grafana folder')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText('Repository status unhealthy')).not.toBeInTheDocument();
      });
    });

    it('transitions from loading to unhealthy to healthy as repository watch events arrive', async () => {
      mockRepositoryList(
        createRepository({
          status: {
            observedGeneration: undefined,
          },
        })
      );

      const { user } = setup(<ProvisioningWizard type="github" />);

      await navigateToBootstrapStep(user);

      expect(screen.getByText('Loading resource information...')).toBeInTheDocument();

      act(() => {
        getMockLiveSrv().emitWatchEvent('repositories', {
          type: 'MODIFIED',
          object: createRepository({
            status: {
              observedGeneration: 1,
              health: {
                healthy: false,
                checked: 1704067200000,
                message: ['Connection failed'],
              },
            },
          }),
        });
      });

      expect(await screen.findByText('Repository status unhealthy')).toBeInTheDocument();

      act(() => {
        getMockLiveSrv().emitWatchEvent('repositories', {
          type: 'MODIFIED',
          object: createRepository(),
        });
      });

      expect(await screen.findByText('Sync external storage to a new Grafana folder')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText('Repository status unhealthy')).not.toBeInTheDocument();
      });
    });
  });

  describe('Synchronization Step', () => {
    it('enables the finish button after the sync job succeeds via a watch event', async () => {
      setupWorkingJobHandlers();
      mockSyncRepositoryLookup();

      const { user } = setup(<ProvisioningWizard type="github" />);
      const { finishButton } = await beginSynchronization(user);
      expect(finishButton).toBeDisabled();

      act(() => {
        getMockLiveSrv().emitWatchEvent('jobs', {
          type: 'MODIFIED',
          object: createJob({ status: { state: 'success' } }),
        });
      });

      await waitFor(() => {
        expect(finishButton).toBeEnabled();
      });
      expect(await screen.findByText(/Your resources are now in your external storage/i)).toBeInTheDocument();
    });

    it('enables the finish button and shows a warning alert when the sync job completes with warnings', async () => {
      setupWorkingJobHandlers();

      const { user } = setup(<ProvisioningWizard type="github" />);
      const { finishButton } = await beginSynchronization(user);
      expect(finishButton).toBeDisabled();

      act(() => {
        getMockLiveSrv().emitWatchEvent('jobs', {
          type: 'MODIFIED',
          object: createJob({ status: { state: 'warning', message: 'Completed with warnings' } }),
        });
      });

      await waitFor(() => {
        expect(finishButton).toBeEnabled();
      });
      expect(await screen.findByText('Job completed with warnings')).toBeInTheDocument();
      expect(screen.getByText('Completed with warnings')).toBeInTheDocument();
    });

    it('shows an error alert and keeps the finish button disabled when the sync job fails', async () => {
      setupWorkingJobHandlers();

      const { user } = setup(<ProvisioningWizard type="github" />);
      const { finishButton } = await beginSynchronization(user);

      act(() => {
        getMockLiveSrv().emitWatchEvent('jobs', {
          type: 'MODIFIED',
          object: createJob({ status: { state: 'error', message: 'Sync failed' } }),
        });
      });

      expect(await screen.findByText('Error running job')).toBeInTheDocument();
      expect(finishButton).toBeDisabled();
    });

    it('continues showing job progress when the watch stream errors (polling fallback)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      try {
        setupWorkingJobHandlers();

        const { user } = setup(<ProvisioningWizard type="github" />);
        const { finishButton } = await beginSynchronization(user);

        act(() => {
          getMockLiveSrv().emitWatchError('jobs', new Error('connection lost'));
        });

        // The polling fallback intercepts the watch error and re-fetches the job.
        // The UI continues showing real job progress instead of an error.
        await waitFor(() => {
          expect(screen.getByText('Pulling...')).toBeInTheDocument();
        });

        // No error is displayed — the fallback is transparent to the user.
        expect(screen.queryByText('Error running job')).not.toBeInTheDocument();
        expect(finishButton).toBeDisabled();
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });

    it('creates a new sync job when retry is clicked after a job error', async () => {
      const createdJobs = [
        createJob({ status: { state: 'pending' } }),
        createJob({
          metadata: { name: 'job-2', uid: 'uid-2' },
          status: { state: 'pending' },
        }),
      ];
      const jobLists = {
        'metadata.name=job-1': createJob(),
        'metadata.name=job-2': createJob({
          metadata: { name: 'job-2', uid: 'uid-2' },
          status: { state: 'working', message: 'Retrying...', progress: 10 },
        }),
      };
      const errorJob = createJob({
        status: { state: 'error', message: 'Sync failed' },
      });

      let createJobCalls = 0;
      server.use(
        http.post(`${BASE}/repositories/:name/jobs`, () => {
          const job = createdJobs[Math.min(createJobCalls, createdJobs.length - 1)];
          createJobCalls++;
          return HttpResponse.json(job);
        }),
        http.get(`${BASE}/jobs`, ({ request }) => {
          const fieldSelector = new URL(request.url).searchParams.get('fieldSelector') ?? 'metadata.name=job-1';
          return HttpResponse.json({
            items: [jobLists[fieldSelector as keyof typeof jobLists]],
            metadata: { resourceVersion: '1' },
          });
        })
      );

      const { user } = setup(<ProvisioningWizard type="github" />);
      await navigateToSynchronizationStep(user);

      await user.click(screen.getByRole('button', { name: /Begin synchronization/i }));
      expect(await screen.findByText('Pulling...')).toBeInTheDocument();

      act(() => {
        getMockLiveSrv().emitWatchEvent('jobs', { type: 'MODIFIED', object: errorJob });
      });

      // Retry is rendered via Alert's buttonContent/onRemove, not as a standard named button
      const retryButton = (await screen.findByText('Retry')).closest('button');
      expect(retryButton).not.toBeNull();
      await user.click(retryButton!);

      await waitFor(() => {
        expect(createJobCalls).toBe(2);
      });
      expect(await screen.findByText('Retrying...')).toBeInTheDocument();
    });
  });

  describe('Different Repository Types', () => {
    it('should render GitLab-specific fields', async () => {
      const { user } = setup(<ProvisioningWizard type="gitlab" />);

      // Auth step fields
      expect(screen.getByText('Project Access Token *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();

      await navigateToConnectionStep(user, 'gitlab', {
        token: 'glpat-test',
        url: 'https://gitlab.com/test/repo',
      });

      // Connection step fields (branch combobox + path combobox)
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
    });

    it('should render Bitbucket-specific fields', async () => {
      const { user } = setup(<ProvisioningWizard type="bitbucket" />);

      // Auth step fields
      expect(screen.getByText('API Token *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Username/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();

      await navigateToConnectionStep(user, 'bitbucket', {
        token: 'test-token',
        tokenUser: 'test-user',
        url: 'https://bitbucket.org/test/repo',
      });

      // Connection step fields (branch combobox + path combobox)
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
    });

    it('should render Git-specific fields', async () => {
      const { user } = setup(<ProvisioningWizard type="git" />);

      // Auth step fields
      expect(screen.getByText('Access Token *')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Username/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Repository URL/i })).toBeInTheDocument();

      await navigateToConnectionStep(user, 'git', {
        token: 'test-token',
        tokenUser: 'test-user',
        url: 'https://git.example.com/test/repo.git',
      });

      // Connection step fields (branch combobox + path combobox)
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
    });

    it('should render local repository fields', async () => {
      const { user } = setup(<ProvisioningWizard type="local" />);

      await navigateToConnectionStep(user, 'local');

      expect(screen.getByRole('textbox', { name: /Path/i })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('glpat-xxxxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('ATATTxxxxxxxxxxxxxxxx')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /Repository URL/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('should accept tokenUser input for Bitbucket provider', async () => {
      const { user } = setup(<ProvisioningWizard type="bitbucket" />);

      await typeIntoTokenField(user, 'ATATTxxxxxxxxxxxxxxxx', 'test-token');
      await pasteIntoInput(user, screen.getByPlaceholderText('username'), 'test-user');
      await pasteIntoInput(
        user,
        screen.getByRole('textbox', { name: /Repository URL/i }),
        'https://bitbucket.org/test/repo'
      );

      expect(screen.getByDisplayValue('test-user')).toBeInTheDocument();
    });

    it('should accept tokenUser input for Git provider', async () => {
      const { user } = setup(<ProvisioningWizard type="git" />);

      await typeIntoTokenField(user, 'token or password', 'test-token');
      await pasteIntoInput(user, screen.getByPlaceholderText('username'), 'test-user');
      await pasteIntoInput(
        user,
        screen.getByRole('textbox', { name: /Repository URL/i }),
        'https://git.example.com/test/repo.git'
      );

      expect(screen.getByDisplayValue('test-user')).toBeInTheDocument();
    });
  });

  it('commits typed path text without Enter when user clicks Choose what to synchronize', async () => {
    const mockSubmitData = setupMockSubmitData();
    const { user } = setup(<ProvisioningWizard type="github" />);

    await navigateToConnectionStep(user, 'github', {
      token: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      url: 'https://github.com/test/repo',
    });

    const pathCombobox = screen.getAllByRole('combobox')[1];
    await user.click(pathCombobox);
    await user.type(pathCombobox, 'docs/dashboards');
    // No Enter — this is the bug scenario: typed text should survive the blur.

    await user.click(screen.getByRole('button', { name: /Choose what to synchronize/i }));

    await waitFor(() => expect(mockSubmitData).toHaveBeenCalledTimes(2));
    const connectionSubmitSpec = mockSubmitData.mock.calls[1][0];
    expect(connectionSubmitSpec.github).toMatchObject({ path: 'docs/dashboards' });
  });
});
