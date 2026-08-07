import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';

import { setupProvisioningMswServer } from '../mocks/server';

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
  it('discovers recognized convention docs in the folder ordered like GitHub', async () => {
    mockRepo('dashboards/team-a');
    mockFiles([
      'dashboards/team-a/SECURITY.md',
      'dashboards/team-a/README.md',
      'dashboards/team-a/dash.json',
      'dashboards/team-a/CONTRIBUTING.md',
      'dashboards/other/README.md',
    ]);

    const { result } = renderHook(() => useFolderDocs('test-folder'), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.docs.map((d) => d.convention.key)).toEqual(['readme', 'contributing', 'security']);
    expect(result.current.sourceDir).toBe('dashboards/team-a');
  });

  it('returns no docs when the folder has none', async () => {
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
});
