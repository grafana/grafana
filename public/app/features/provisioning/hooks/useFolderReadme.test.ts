import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';

import { createJob } from '../mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from '../mocks/server';

import { isReadmeRefreshingJob, readmeRefetchJobNames, useFolderReadme } from './useFolderReadme';
import { RepoViewStatus, useGetResourceRepositoryView } from './useGetResourceRepositoryView';

jest.mock('./useGetResourceRepositoryView', () => ({
  ...jest.requireActual('./useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

// Unit-test the decision directly: the refetch→GET chain is async and RTK Query
// coalesces overlapping refetches, so a wrongly-included push can't be told apart
// from one merged into the next pull's GET via rendered content. The integration
// test below still covers the live wiring end-to-end.
describe('isReadmeRefreshingJob', () => {
  it.each(['pull', 'migrate'] as const)('accepts a successful %s', (action) => {
    expect(isReadmeRefreshingJob(createJob({ spec: { action }, status: { state: 'success' } }))).toBe(true);
  });

  it.each(['pull', 'migrate'] as const)('accepts a %s that finished with warnings', (action) => {
    expect(isReadmeRefreshingJob(createJob({ spec: { action }, status: { state: 'warning' } }))).toBe(true);
  });

  it.each(['error', 'pending', 'working'] as const)('rejects a pull in %s state', (state) => {
    expect(isReadmeRefreshingJob(createJob({ spec: { action: 'pull' }, status: { state } }))).toBe(false);
  });

  // push/pr/move/delete mutate only the remote, never the Grafana-side README.
  it.each(['push', 'pr', 'move', 'delete'] as const)('rejects a successful %s', (action) => {
    expect(isReadmeRefreshingJob(createJob({ spec: { action }, status: { state: 'success' } }))).toBe(false);
  });

  it('rejects a job missing spec/status', () => {
    expect(isReadmeRefreshingJob({ metadata: { name: 'bare' } })).toBe(false);
  });
});

describe('readmeRefetchJobNames', () => {
  it('returns the names of completed pull/migrate jobs', () => {
    const jobs = [
      createJob({ metadata: { name: 'pull-ok' }, spec: { action: 'pull' }, status: { state: 'success' } }),
      createJob({ metadata: { name: 'migrate-warn' }, spec: { action: 'migrate' }, status: { state: 'warning' } }),
      createJob({ metadata: { name: 'push-ok' }, spec: { action: 'push' }, status: { state: 'success' } }),
      createJob({ metadata: { name: 'pull-failed' }, spec: { action: 'pull' }, status: { state: 'error' } }),
      createJob({ metadata: { name: 'pull-running' }, spec: { action: 'pull' }, status: { state: 'working' } }),
    ];

    expect(readmeRefetchJobNames(jobs, new Set())).toEqual(['pull-ok', 'migrate-warn']);
  });

  it('skips jobs already handled so each completed pull refetches once', () => {
    const jobs = [
      createJob({ metadata: { name: 'pull-a' }, status: { state: 'success' } }),
      createJob({ metadata: { name: 'pull-b' }, status: { state: 'success' } }),
    ];

    expect(readmeRefetchJobNames(jobs, new Set(['pull-a']))).toEqual(['pull-b']);
  });

  it('returns nothing when no job warrants a refetch', () => {
    const jobs = [createJob({ spec: { action: 'push' }, status: { state: 'success' } })];

    expect(readmeRefetchJobNames(jobs, new Set())).toEqual([]);
  });
});

setupProvisioningMswServer();

const mockRepoView = jest.mocked(useGetResourceRepositoryView);

// Matches createJob's default repository label so the watch's labelSelector
// lines up with the emitted job.
const REPO_NAME = 'test-repo-abc123';

describe('useFolderReadme live refresh wiring', () => {
  beforeEach(() => {
    mockRepoView.mockReturnValue({
      repository: { name: REPO_NAME, title: 'Repo', type: 'github', target: 'folder', workflows: [] },
      folder: undefined,
      status: RepoViewStatus.Ready,
      isLoading: false,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      isMissingRepo: false,
    });
  });

  it('refetches and shows new README content when a pull job completes', async () => {
    let readme = '# v1';
    let fileHits = 0;
    server.use(
      http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [], metadata: { resourceVersion: '1' } })),
      http.get(`${BASE}/repositories/:name/files/*`, () => {
        fileHits++;
        return HttpResponse.json({ resource: { file: readme } });
      })
    );

    const { result } = renderHook(() => useFolderReadme('test-folder'), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.markdownContent).toBe('# v1'));
    expect(fileHits).toBe(1);

    // Remote edit replicated by a pull: the watch must surface it with no reload.
    readme = '# v2';
    act(() =>
      getMockLiveSrv().emitWatchEvent('jobs', { type: 'ADDED', object: createJob({ status: { state: 'success' } }) })
    );

    await waitFor(() => expect(result.current.markdownContent).toBe('# v2'));
    expect(fileHits).toBe(2);
  });
});
