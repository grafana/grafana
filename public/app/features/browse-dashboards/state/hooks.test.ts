import { http, HttpResponse } from 'msw';
import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, starsRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setMockStarredFolders } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { STARRED_FOLDERS_UID } from 'app/features/search/constants';
import { type DashboardViewItem } from 'app/features/search/types';
import { invalidateStarredSearch } from 'app/features/stars/api';
import { configureStore } from 'app/store/configureStore';

import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';
import { type BrowseDashboardsState, type DashboardsTreeItem } from '../types';

import { useBrowseLoadingStatus, useFlatTreeState } from './hooks';

setBackendSrv(backendSrv);
setupMockServer();

const [, { folderA }] = getFolderFixtures();

function createInitialState(partial: Partial<BrowseDashboardsState>): BrowseDashboardsState {
  return {
    rootItems: undefined,
    childrenByParentUID: {},
    openFolders: {},
    selectedItems: {
      $all: false,
      dashboard: {},
      folder: {},
      panel: {},
    },

    ...partial,
  };
}

function renderBrowseHook<T>(hook: () => T, browseDashboards: BrowseDashboardsState) {
  const store = configureStore({ browseDashboards });
  return { ...renderHook(hook, { wrapper: getWrapper({ store }) }), store };
}

const rowsOf = (tree: DashboardsTreeItem[]) => tree.map(({ item, level }) => `${level}:${item.kind}:${item.uid}`);

describe('browse-dashboards state hooks', () => {
  const folderUID = 'abc-123';

  describe('useBrowseLoadingStatus', () => {
    it('returns loading when root view is loading', () => {
      const { result } = renderBrowseHook(
        () => useBrowseLoadingStatus(undefined),
        createInitialState({ rootItems: undefined })
      );
      expect(result.current).toEqual('pending');
    });

    it('returns loading when folder view is loading', () => {
      const { result } = renderBrowseHook(
        () => useBrowseLoadingStatus(folderUID),
        createInitialState({ childrenByParentUID: {} })
      );
      expect(result.current).toEqual('pending');
    });

    it('returns fulfilled when root view is finished loading', () => {
      const { result } = renderBrowseHook(
        () => useBrowseLoadingStatus(undefined),
        createInitialState({ rootItems: fullyLoadedViewItemCollection([]) })
      );
      expect(result.current).toEqual('fulfilled');
    });

    it('returns fulfilled when folder view is finished loading', () => {
      const { result } = renderBrowseHook(
        () => useBrowseLoadingStatus(folderUID),
        createInitialState({ childrenByParentUID: { [folderUID]: fullyLoadedViewItemCollection([]) } })
      );
      expect(result.current).toEqual('fulfilled');
    });
  });

  describe('useFlatTreeState', () => {
    it('renders a dashboard whose UID matches its parent folder', () => {
      const folder: DashboardViewItem = { kind: 'folder', uid: 'same-uid', title: 'Folder' };
      const dashboard: DashboardViewItem = {
        kind: 'dashboard',
        uid: 'same-uid',
        title: 'Dashboard',
        parentUID: 'same-uid',
      };

      const { result } = renderBrowseHook(
        () => useFlatTreeState(undefined),
        createInitialState({
          rootItems: fullyLoadedViewItemCollection([folder]),
          childrenByParentUID: { 'same-uid': fullyLoadedViewItemCollection([dashboard]) },
          openFolders: { 'same-uid': true },
        })
      );

      expect(rowsOf(result.current)).toEqual(['0:folder:same-uid', '1:dashboard:same-uid']);
      expect(result.current[0].isLoading).toBe(false);
    });

    it('marks an open folder loading until its first page of children is in the store', () => {
      const folder: DashboardViewItem = { kind: 'folder', uid: 'f1', title: 'Folder' };
      const { result } = renderBrowseHook(
        () => useFlatTreeState(undefined),
        createInitialState({ rootItems: fullyLoadedViewItemCollection([folder]), openFolders: { f1: true } })
      );

      expect(result.current[0].isLoading).toBe(true);
    });

    describe('under the open Starred folders root', () => {
      const starredRoot: DashboardViewItem = { kind: 'folder', uid: STARRED_FOLDERS_UID, title: 'Starred folders' };
      const openStarredRoot = () =>
        createInitialState({
          rootItems: fullyLoadedViewItemCollection([starredRoot]),
          openFolders: { [STARRED_FOLDERS_UID]: true },
        });
      const prefixedUid = `${STARRED_FOLDERS_UID}/${folderA.item.uid}`;

      beforeEach(() => {
        // Beside the dashboards the fixtures star, which the tree must leave out
        setMockStarredFolders([folderA.item.uid]);
      });

      it('lists the starred folders the shared starred search returns, under prefixed uids', async () => {
        const { result } = renderBrowseHook(() => useFlatTreeState(undefined), openStarredRoot());

        // Loading, with nothing under the root, until the first rows land
        expect(rowsOf(result.current)).toEqual([
          `0:folder:${STARRED_FOLDERS_UID}`,
          `1:ui:${STARRED_FOLDERS_UID}-divider`,
        ]);
        expect(result.current[0].isLoading).toBe(true);

        await waitFor(() =>
          expect(rowsOf(result.current)).toEqual([
            `0:folder:${STARRED_FOLDERS_UID}`,
            `1:folder:${prefixedUid}`,
            `1:ui:${STARRED_FOLDERS_UID}-divider`,
          ])
        );
        // The derived collection counts as loaded, or the row would spin forever
        expect(result.current[0].isLoading).toBe(false);
        expect(result.current[1].item).toMatchObject({
          title: folderA.item.title,
          parentUID: STARRED_FOLDERS_UID,
          url: expect.stringContaining(`/dashboards/f/${folderA.item.uid}/`),
        });
      });

      it('shows a renamed starred folder once the starred search is invalidated', async () => {
        const { result, store } = renderBrowseHook(() => useFlatTreeState(undefined), openStarredRoot());
        await waitFor(() => expect(result.current[1]?.item).toMatchObject({ title: folderA.item.title }));

        // A rename changes a row without changing the star set, so the rename mutations invalidate the rows
        server.use(
          getCustomSearchHandler([{ resource: 'folders', name: folderA.item.uid, title: 'Renamed folder', field: {} }])
        );
        store.dispatch(invalidateStarredSearch());

        await waitFor(() => expect(result.current[1]?.item).toMatchObject({ title: 'Renamed folder' }));
      });

      it('shows the root empty rather than loading when the star set cannot be read', async () => {
        // An anonymous user's star set is named `user-`, which the server refuses
        server.use(
          http.get(starsRoute, () => HttpResponse.json({ kind: 'Status', status: 'Failure' }, { status: 403 }))
        );
        const { result } = renderBrowseHook(() => useFlatTreeState(undefined), openStarredRoot());

        await waitFor(() => expect(result.current[0].isLoading).toBe(false));
        expect(rowsOf(result.current)).toEqual([
          `0:folder:${STARRED_FOLDERS_UID}`,
          `1:ui:${STARRED_FOLDERS_UID}empty-folder`,
          `1:ui:${STARRED_FOLDERS_UID}-divider`,
        ]);
      });
    });
  });
});
