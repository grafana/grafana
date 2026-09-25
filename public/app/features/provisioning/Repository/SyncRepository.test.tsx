import { render, screen } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';
import {
  type Repository,
  useCreateRepositoryJobsMutation,
  useListJobQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { SyncRepository } from './SyncRepository';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useCreateRepositoryJobsMutation: jest.fn(),
  useListJobQuery: jest.fn(),
}));

const mockCreateJob = jest.fn();

const createMockRepository = (overrides: Partial<Repository> = {}): Repository => ({
  metadata: { name: 'test-repo' },
  spec: {
    title: 'Test Repository',
    type: 'github',
    sync: { target: 'folder', enabled: true },
    workflows: [],
    github: {
      url: 'https://github.com/owner/repo',
      branch: 'main',
    },
  },
  status: {
    health: { healthy: true, checked: 0 },
    sync: { state: 'success', message: [] },
    observedGeneration: 1,
    webhook: {},
  },
  ...overrides,
});

const setActiveJobs = (items: unknown[] = []) => {
  jest.mocked(useListJobQuery).mockReturnValue({ data: { items } } as unknown as ReturnType<typeof useListJobQuery>);
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useCreateRepositoryJobsMutation).mockReturnValue([mockCreateJob, { isLoading: false, reset: jest.fn() }]);
  setActiveJobs([]);
});

describe('SyncRepository', () => {
  it('renders the pull button', () => {
    render(<SyncRepository repository={createMockRepository()} />);

    expect(screen.getByRole('button', { name: /pull/i })).toBeInTheDocument();
  });

  it('disables the button and shows a tooltip when the repository is unhealthy', () => {
    const repo = createMockRepository({
      status: {
        health: { healthy: false, checked: 0 },
        sync: { state: 'success', message: [] },
        observedGeneration: 1,
        webhook: {},
      },
    });
    render(<SyncRepository repository={repo} />);

    // With a tooltip present, grafana-ui uses aria-disabled (not the native
    // disabled attribute) so the tooltip still fires on hover.
    expect(screen.getByRole('button', { name: /pull/i })).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables the button when a job is already working', () => {
    setActiveJobs([{ status: { state: 'working' } }]);
    render(<SyncRepository repository={createMockRepository()} />);

    expect(screen.getByRole('button', { name: /pull/i })).toBeDisabled();
  });

  it('disables the button when a job is pending', () => {
    setActiveJobs([{ status: { state: 'pending' } }]);
    render(<SyncRepository repository={createMockRepository()} />);

    expect(screen.getByRole('button', { name: /pull/i })).toBeDisabled();
  });

  it('disables the button while the create job mutation is loading', () => {
    jest
      .mocked(useCreateRepositoryJobsMutation)
      .mockReturnValue([mockCreateJob, { isLoading: true, reset: jest.fn() }]);
    render(<SyncRepository repository={createMockRepository()} />);

    expect(screen.getByRole('button', { name: /pull/i })).toBeDisabled();
  });

  it('triggers an incremental pull and reports the interaction', async () => {
    const { user } = render(<SyncRepository repository={createMockRepository()} />);

    await user.click(screen.getByRole('button', { name: /pull/i }));
    await user.click(screen.getByRole('menuitem', { name: /pull based on diff/i }));

    expect(mockCreateJob).toHaveBeenCalledWith({
      name: 'test-repo',
      jobSpec: { action: 'pull', pull: { incremental: true } },
    });
    expect(reportInteraction).toHaveBeenCalledWith('grafana_provisioning_repository_pull_triggered', {
      repositoryName: 'test-repo',
      repositoryType: 'github',
      target: 'folder',
      incremental: true,
    });
  });

  it('asks for confirmation before a full pull and triggers it on confirm', async () => {
    const publishSpy = jest.spyOn(appEvents, 'publish');
    const { user } = render(<SyncRepository repository={createMockRepository()} />);

    await user.click(screen.getByRole('button', { name: /pull/i }));
    await user.click(screen.getByRole('menuitem', { name: /force full pull/i }));

    // The confirm modal is shown via an app event; the job is not created yet.
    expect(publishSpy).toHaveBeenCalledWith(expect.any(ShowConfirmModalEvent));
    expect(mockCreateJob).not.toHaveBeenCalled();

    const event = publishSpy.mock.calls[0][0] as ShowConfirmModalEvent;
    event.payload.onConfirm?.();

    expect(mockCreateJob).toHaveBeenCalledWith({
      name: 'test-repo',
      jobSpec: { action: 'pull', pull: { incremental: false } },
    });
    expect(reportInteraction).toHaveBeenCalledWith('grafana_provisioning_repository_pull_triggered', {
      repositoryName: 'test-repo',
      repositoryType: 'github',
      target: 'folder',
      incremental: false,
    });
  });

  it('does not trigger a pull when the repository has no name', async () => {
    const repo = createMockRepository({ metadata: {} });
    const { user } = render(<SyncRepository repository={repo} />);

    // No name means the button is disabled, so the menu cannot be opened.
    expect(screen.getByRole('button', { name: /pull/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /pull/i }));
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    expect(mockCreateJob).not.toHaveBeenCalled();
  });
});
