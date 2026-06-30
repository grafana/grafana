import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';

import { createRepository } from '../mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from '../mocks/server';

import { useFolderReadme } from './useFolderReadme';
import { RepoViewStatus, useGetResourceRepositoryView } from './useGetResourceRepositoryView';

jest.mock('./useGetResourceRepositoryView', () => ({
  ...jest.requireActual('./useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

setupProvisioningMswServer();

const mockRepoView = jest.mocked(useGetResourceRepositoryView);

// Matches createRepository's default name so the watch's fieldSelector matches.
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

  // status.sync is the durable signal: a newer `finished` once per completed pull.
  // (The Job is deleted on completion, so its terminal state is never watchable.)
  function setup() {
    let readme = '# v1';
    let fileHits = 0;
    server.use(
      http.get(`${BASE}/repositories`, () =>
        HttpResponse.json({
          items: [createRepository({ status: { sync: { state: 'success', finished: 1000, message: [] } } })],
          metadata: { resourceVersion: '1' },
        })
      ),
      http.get(`${BASE}/repositories/:name/files/*`, () => {
        fileHits++;
        return HttpResponse.json({ resource: { file: readme } });
      })
    );
    return {
      setReadme: (next: string) => {
        readme = next;
      },
      getFileHits: () => fileHits,
    };
  }

  function emitSync(state: string, finished: number) {
    act(() =>
      getMockLiveSrv().emitWatchEvent('repositories', {
        type: 'MODIFIED',
        object: createRepository({ status: { sync: { state, finished, message: [] } } }),
      })
    );
  }

  it('refetches and shows new README content when a newer pull sync completes', async () => {
    const { setReadme, getFileHits } = setup();

    const { result } = renderHook(() => useFolderReadme('test-folder'), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.markdownContent).toBe('# v1'));
    expect(getFileHits()).toBe(1);

    // Remote edit replicated by a pull: the watch must surface it with no reload.
    setReadme('# v2');
    emitSync('success', 2000);

    await waitFor(() => expect(result.current.markdownContent).toBe('# v2'));
    expect(getFileHits()).toBe(2);
  });

  it('does not refetch when the sync finished timestamp has not advanced', async () => {
    const { setReadme, getFileHits } = setup();

    const { result } = renderHook(() => useFolderReadme('test-folder'), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.markdownContent).toBe('# v1'));
    expect(getFileHits()).toBe(1);

    // Same `finished` as the baseline (e.g. a health-check status update) — no refetch.
    setReadme('# v2');
    emitSync('success', 1000);

    await act(() => Promise.resolve());
    expect(getFileHits()).toBe(1);
    expect(result.current.markdownContent).toBe('# v1');
  });

  it('does not refetch when a newer sync finished but did not write content', async () => {
    const { setReadme, getFileHits } = setup();

    const { result } = renderHook(() => useFolderReadme('test-folder'), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.markdownContent).toBe('# v1'));
    expect(getFileHits()).toBe(1);

    // A failed sync advances `finished` but wrote nothing — README must not refetch.
    setReadme('# v2');
    emitSync('error', 2000);

    await act(() => Promise.resolve());
    expect(getFileHits()).toBe(1);
    expect(result.current.markdownContent).toBe('# v1');
  });
});
