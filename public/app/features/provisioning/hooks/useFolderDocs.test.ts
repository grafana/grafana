import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';

import { createRepository } from '../mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from '../mocks/server';

import { useFolderDocs } from './useFolderDocs';
import { RepoViewStatus, useGetResourceRepositoryView } from './useGetResourceRepositoryView';

jest.mock('./useGetResourceRepositoryView', () => ({
  ...jest.requireActual('./useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

setupProvisioningMswServer();

const mockRepoView = jest.mocked(useGetResourceRepositoryView);
const REPO_NAME = 'test-repo-abc123';

function mockRepo(sourcePath: string | undefined) {
  mockRepoView.mockReturnValue({
    repository: { name: REPO_NAME, title: 'Repo', type: 'github', target: 'folder', workflows: [] },
    folder: sourcePath ? ({ metadata: { annotations: { 'grafana.app/sourcePath': sourcePath } } } as never) : undefined,
    status: RepoViewStatus.Ready,
    isLoading: false,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    isMissingRepo: false,
  });
}

function mockFiles(paths: string[]) {
  server.use(
    http.get(`${BASE}/repositories/:name/files/`, () =>
      HttpResponse.json({ items: paths.map((path) => ({ path, hash: 'abc' })) })
    )
  );
}

describe('useFolderDocs', () => {
  it("lists only the markdown directly inside the folder's source path", async () => {
    mockRepo('dashboards/team-a');
    mockFiles([
      'dashboards/team-a/README.md',
      'dashboards/team-a/SECURITY.md',
      'dashboards/team-a/dash.json',
      'dashboards/team-a/nested/README.md',
      'dashboards/other/README.md',
    ]);

    const { result } = renderHook(() => useFolderDocs('test-folder'), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.docs.map((d) => d.path)).toEqual([
      'dashboards/team-a/README.md',
      'dashboards/team-a/SECURITY.md',
    ]);
  });

  it('returns only a synthetic README when the folder has no markdown', async () => {
    mockRepo('dashboards/team-a');
    mockFiles(['dashboards/team-a/dash.json']);

    const { result } = renderHook(() => useFolderDocs('test-folder'), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.docs).toEqual([
      { key: 'readme', path: 'dashboards/team-a/README.md', fileName: 'README.md' },
    ]);
  });

  it('resolves docs at the repository root when the folder has no source path', async () => {
    mockRepo(undefined);
    mockFiles(['README.md', 'SECURITY.md', 'nested/README.md']);

    const { result } = renderHook(() => useFolderDocs('test-folder'), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.docs.map((d) => d.path)).toEqual(['README.md', 'SECURITY.md']);
  });

  it('refetches the file list when a pull sync completes, updating the tabs', async () => {
    mockRepo('dashboards/team-a');
    let files = ['dashboards/team-a/README.md'];
    let fileHits = 0;
    server.use(
      http.get(`${BASE}/repositories`, () =>
        HttpResponse.json({
          items: [createRepository({ status: { sync: { state: 'success', finished: 1000, message: [] } } })],
          metadata: { resourceVersion: '1' },
        })
      ),
      http.get(`${BASE}/repositories/:name/files/`, () => {
        fileHits++;
        return HttpResponse.json({ items: files.map((path) => ({ path, hash: 'x' })) });
      })
    );

    const { result } = renderHook(() => useFolderDocs('test-folder'), { wrapper: getWrapper({}) });
    // The README tab is synthesized before the listing arrives, so wait on the request itself.
    await waitFor(() => expect(fileHits).toBe(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.docs.map((d) => d.fileName)).toEqual(['README.md']);

    // A pull adds SECURITY.md; the completed sync should refresh the listing.
    files = ['dashboards/team-a/README.md', 'dashboards/team-a/SECURITY.md'];
    act(() =>
      getMockLiveSrv().emitWatchEvent('repositories', {
        type: 'MODIFIED',
        object: createRepository({ status: { sync: { state: 'success', finished: 2000, message: [] } } }),
      })
    );

    await waitFor(() => expect(result.current.docs.map((d) => d.fileName)).toEqual(['README.md', 'SECURITY.md']));
  });
});
