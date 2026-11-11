import { http, HttpResponse } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { type DashboardViewItem } from 'app/features/search/types';

import { useFoldersQuery, type UseFoldersQueryProps } from './useFoldersQuery';
import { getCustomRootFolderItem, getRootFolderItem } from './utils';

const [, { folderA, folderB, folderC, folderD, folderA_folderA, folderA_folderB, folderA_folderC }] =
  getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();

const collator = new Intl.Collator();

// The hook sorts siblings by title, so expectations are built from the fixtures in that order.
function sortedUids(folders: Array<DashboardsTreeItem<DashboardViewItem>>) {
  return [...folders].sort((a, b) => collator.compare(a.item.title, b.item.title)).map((folder) => folder.item.uid);
}

function uids(items: DashboardsTreeItem[]) {
  return items.map((treeItem) => treeItem.item.uid);
}

function renderFoldersQuery(props: Partial<UseFoldersQueryProps> = {}) {
  return renderHook(() => useFoldersQuery({ isBrowsing: true, openFolders: {}, ...props }), {
    wrapper: getWrapper({}),
  });
}

describe('useFoldersQuery', () => {
  it('loads the top-level folders under the root and the virtual "Shared with me" folder', async () => {
    const { result } = renderFoldersQuery();

    expect(result.current.items[0]).toEqual(getRootFolderItem());
    expect(result.current.isLoading).toBe(false);

    act(() => result.current.requestNextPage(undefined));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const [root, sharedWithMe, ...folders] = result.current.items;
    expect(root).toEqual(getRootFolderItem());
    expect(sharedWithMe).toMatchObject({
      level: 1,
      disabled: true,
      item: { kind: 'folder', uid: 'sharedwithme', title: 'Shared with me', parentUID: undefined },
    });
    expect(uids(folders)).toEqual(sortedUids([folderA, folderB, folderC, folderD]));
    expect(folders).toEqual(
      folders.map(() => expect.objectContaining({ level: 1, item: expect.objectContaining({ parentUID: undefined }) }))
    );
  });

  it('only lists folders the user can edit when permission is "edit"', async () => {
    const { result } = renderFoldersQuery({ permission: 'edit' });

    act(() => result.current.requestNextPage(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const [, , ...folders] = result.current.items;
    expect(uids(folders)).toEqual(sortedUids([folderA, folderC, folderD]));
  });

  it('nests loaded children under their open parent and tracks parents that turn out empty', async () => {
    const { result } = renderFoldersQuery({ openFolders: { [folderA.item.uid]: true, [folderB.item.uid]: true } });

    act(() => result.current.requestNextPage(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Children are only fetched on request, so open folders without a response render as leaves.
    expect(uids(result.current.items)).not.toContain(folderA_folderA.item.uid);
    expect(result.current.emptyFolders.size).toBe(0);

    act(() => {
      result.current.requestNextPage(folderA.item.uid);
      result.current.requestNextPage(folderB.item.uid);
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const items = result.current.items;
    const indexOfA = uids(items).indexOf(folderA.item.uid);
    const childrenOfA = items.slice(indexOfA + 1, indexOfA + 4);
    expect(uids(childrenOfA)).toEqual(sortedUids([folderA_folderA, folderA_folderB, folderA_folderC]));
    expect(childrenOfA).toEqual(
      childrenOfA.map(() =>
        expect.objectContaining({ level: 2, item: expect.objectContaining({ parentUID: folderA.item.uid }) })
      )
    );
    expect(result.current.emptyFolders).toEqual(new Set([folderB.item.uid]));
  });

  it('treats the "general" parent sentinel as the root', async () => {
    server.use(
      getCustomSearchHandler([{ name: 'repo-root', title: 'Repo root', folder: 'general', resource: 'folders' }])
    );
    const { result } = renderFoldersQuery();

    act(() => result.current.requestNextPage(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const repositoryRoot = result.current.items.find((treeItem) => treeItem.item.uid === 'repo-root');
    expect(repositoryRoot).toMatchObject({ level: 1, item: { parentUID: undefined } });
  });

  it('browses from rootFolderUID with the given root item and without the virtual folder', async () => {
    const rootFolderItem = getCustomRootFolderItem({
      title: 'Test Repo',
      managedBy: ManagerKind.Repo,
      uid: folderA.item.uid,
    });
    const { result } = renderFoldersQuery({ rootFolderUID: folderA.item.uid, rootFolderItem });

    expect(result.current.items[0]).toEqual(rootFolderItem);

    act(() => result.current.requestNextPage(folderA.item.uid));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const [root, ...children] = result.current.items;
    expect(root).toEqual(rootFolderItem);
    expect(uids(children)).toEqual(sortedUids([folderA_folderA, folderA_folderB, folderA_folderC]));
  });

  it('surfaces a failed search as an error', async () => {
    server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'search unavailable' }, { status: 500 })));
    const { result } = renderFoldersQuery();

    act(() => result.current.requestNextPage(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toEqual(new Error('search unavailable'));
  });
});
