import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Job, type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { createJob, createRepository } from '../mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from '../mocks/server';

import { JobStatus } from './JobStatus';

setupProvisioningMswServer();

function mockJobList(job: Job) {
  server.use(
    http.get(`${BASE}/jobs`, () =>
      HttpResponse.json({
        items: [job],
        metadata: { resourceVersion: '1' },
      })
    )
  );
}

function mockRepositoryLookup(repository: Repository = createRepository()) {
  server.use(http.get(`${BASE}/repositories/:name`, () => HttpResponse.json(repository)));
}

function setupComponent(options?: { watch?: Job; onStatusChange?: jest.Mock }) {
  const watch = options?.watch ?? createJob({ status: { state: 'pending' } });
  const onStatusChange = options?.onStatusChange;

  return render(<JobStatus watch={watch} jobType="sync" onStatusChange={onStatusChange} />);
}

describe('JobStatus', () => {
  it('shows working progress while the job is running', async () => {
    mockJobList(createJob());

    setupComponent();

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progress Bar' })).toHaveAttribute('aria-valuenow', '30');
  });

  it('updates the UI when a watch event transitions the job to success', async () => {
    const workingJob = createJob();
    const successJob = createJob({
      status: {
        state: 'success',
      },
    });

    mockJobList(workingJob);
    mockRepositoryLookup();

    setupComponent();

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();

    act(() => {
      getMockLiveSrv().emitWatchEvent('jobs', { type: 'MODIFIED', object: successJob });
    });

    expect(await screen.findByText(/Your resources are now in your external storage/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View repository' })).toHaveAttribute(
      'href',
      'https://github.com/test/repo/tree/main'
    );
  });

  it('calls onStatusChange when a watch event transitions the job to error', async () => {
    const onStatusChange = jest.fn();
    const workingJob = createJob();
    const errorJob = createJob({
      status: {
        state: 'error',
        message: 'Sync failed',
      },
    });

    mockJobList(workingJob);

    setupComponent({ onStatusChange });

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();

    act(() => {
      getMockLiveSrv().emitWatchEvent('jobs', { type: 'MODIFIED', object: errorJob });
    });

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({
        status: 'error',
        error: {
          title: 'Error running job',
          message: ['Sync failed'],
        },
        warning: undefined,
        action: undefined,
      });
    });
  });

  it('calls onStatusChange for running and success state transitions', async () => {
    const onStatusChange = jest.fn();
    const workingJob = createJob();
    const successJob = createJob({
      status: {
        state: 'success',
      },
    });

    mockJobList(workingJob);
    mockRepositoryLookup();

    setupComponent({ onStatusChange });

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ status: 'running' });
    });

    act(() => {
      getMockLiveSrv().emitWatchEvent('jobs', { type: 'MODIFIED', object: successJob });
    });

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ status: 'success' });
    });
  });

  it('continues showing real job state when watch stream errors (polling fallback)', async () => {
    const onStatusChange = jest.fn();
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    mockJobList(createJob());

    setupComponent({ onStatusChange });

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();

    act(() => {
      getMockLiveSrv().emitWatchError('jobs', new Error('connection lost'));
    });

    // The polling fallback intercepts the watch error and re-fetches real state.
    // Wait for the poll to complete and re-update the cache.
    await waitFor(() => {
      expect(onStatusChange.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    // No artificial error state — the job continues showing its real server state.
    expect(onStatusChange).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
    expect(screen.getByText('Pulling...')).toBeInTheDocument();

    consoleWarnSpy.mockRestore();
  });
});
