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
  it('discovers convention docs first, then other markdown, ordered like GitHub', async () => {
    mockRepo('dashboards/team-a');
    mockFiles([
      'dashboards/team-a/SECURITY.md',
      'dashboards/team-a/README.md',
      'dashboards/team-a/dash.json',
      'dashboards/team-a/CONTRIBUTING.md',
      'dashboards/team-a/CHANGELOG.md',
      'dashboards/other/README.md',
    ]);

    const { result } = renderHook(() => useFolderDocs('test-folder'), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.docs.map((d) => d.fileName)).toEqual([
      'README.md',
      'CONTRIBUTING.md',
      'SECURITY.md',
      'CHANGELOG.md',
    ]);
    expect(result.current.docs[3].key).toBeUndefined();
    expect(result.current.sourceDir).toBe('dashboards/team-a');
  });

  it('returns no docs when the folder has no markdown', async () => {
    mockRepo('dashboards/team-a');
    mockFiles(['dashboards/team-a/dash.json']);

    const { result } = renderHook(() => useFolderDocs('test-folder'), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.docs).toEqual([]);
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
    server.use(
      http.get(`${BASE}/repositories`, () =>
        HttpResponse.json({
          items: [createRepository({ status: { sync: { state: 'success', finished: 1000, message: [] } } })],
          metadata: { resourceVersion: '1' },
        })
      ),
      http.get(`${BASE}/repositories/:name/files/`, () =>
        HttpResponse.json({ items: files.map((path) => ({ path, hash: 'x' })) })
      )
    );

    const { result } = renderHook(() => useFolderDocs('test-folder'), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.docs.map((d) => d.fileName)).toEqual(['README.md']));

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
