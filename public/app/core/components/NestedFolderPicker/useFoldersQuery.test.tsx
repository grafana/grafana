import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import * as runtime from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { ManagerKind } from 'app/features/apiserver/types';

import { type DashboardViewItem } from '../../../features/search/types';

import { useFoldersQuery } from './useFoldersQuery';
import { getCustomRootFolderItem, getRootFolderItem } from './utils';

const [_, { folderA, folderB, folderC, folderD }] = getFolderFixtures();

runtime.setBackendSrv(backendSrv);
setupMockServer();

const wrapper = ({ children }: { children: ReactNode }) => {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  return <ProviderWrapper>{children}</ProviderWrapper>;
};

describe('useFoldersQuery', () => {
  describe('app-platform pagination', () => {
    beforeEach(() => setTestFlags({ foldersAppPlatformAPI: true }));
    afterEach(async () => {
      await act(async () => setTestFlags({}));
    });

    it('retries a failed child page without losing the loaded parent or children', async () => {
      const requests: Array<[string | null, number]> = [];
      let failNextPage = true;
      const children = Array.from({ length: 51 }, (_, index) => ({
        name: `child-${index}`,
        title: `Child ${String(index).padStart(2, '0')}`,
        resource: 'folder',
        folder: 'parent',
      }));
      server.use(
        http.get('/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/search', ({ request }) => {
          const params = new URL(request.url).searchParams;
          const folder = params.get('folder');
          const offset = Number(params.get('offset') ?? 0);
          requests.push([folder, offset]);
          if (folder === 'general') {
            return HttpResponse.json({
              hits: [{ name: 'parent', title: 'Parent', resource: 'folder' }],
              totalHits: 1,
            });
          }
          if (offset === 50 && failNextPage) {
            failNextPage = false;
            return HttpResponse.json({ message: 'Search unavailable' }, { status: 500 });
          }
          return HttpResponse.json({ hits: children.slice(offset, offset + 50), totalHits: 51, offset });
        })
      );
      const { result } = renderHook(() => useFoldersQuery({ isBrowsing: true, openFolders: { parent: true } }), {
        wrapper,
      });
      act(() => result.current.requestNextPage(undefined));
      await waitFor(() => expect(result.current.items.some(({ item }) => item.uid === 'parent')).toBe(true));
      act(() => result.current.requestNextPage('parent'));
      await waitFor(() => expect(result.current.items.some(({ item }) => item.uid === 'child-49')).toBe(true));
      act(() => result.current.requestNextPage('parent'));
      await waitFor(() => expect(result.current.error?.message).toBe('Search unavailable'));
      expect(result.current.items.some(({ item }) => item.uid === 'child-0')).toBe(true);
      act(() => result.current.requestNextPage('parent'));
      await waitFor(() => expect(result.current.items.some(({ item }) => item.uid === 'child-50')).toBe(true));
      expect(result.current.items.filter(({ item }) => item.uid === 'parent')).toHaveLength(1);
      expect(result.current.items.some(({ item, parentUID }) => item.kind === 'ui' && parentUID === 'parent')).toBe(
        false
      );
      expect(requests).toEqual([
        ['general', 0],
        ['parent', 0],
        ['parent', 50],
        ['parent', 50],
      ]);
    });

    it.each(['general', 'parent-folder', 'sharedwithme'])(
      'loads every page under %s without replacing earlier folders',
      async (parent) => {
        const requests: number[] = [];
        const hits = Array.from({ length: 103 }, (_, index) => ({
          name: `folder-${index}`,
          title: `Folder ${String(index).padStart(3, '0')}`,
          resource: 'folder',
          folder: parent,
        }));
        server.use(
          http.get('/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/search', ({ request }) => {
            const params = new URL(request.url).searchParams;
            expect(params.get('folder')).toBe(parent);
            expect(params.get('permission')).toBe('edit');
            const offset = Number(params.get('offset') ?? 0);
            const limit = Number(params.get('limit') ?? 50);
            requests.push(offset);
            return HttpResponse.json({ hits: hits.slice(offset, offset + limit), totalHits: 103, offset });
          })
        );
        const { result, unmount } = renderHook(
          () => useFoldersQuery({ isBrowsing: true, openFolders: {}, rootFolderUID: parent, permission: 'edit' }),
          { wrapper }
        );
        const load = () => act(() => result.current.requestNextPage(parent));
        load();
        await waitFor(() => expect(result.current.items.some(({ item }) => item.uid === 'folder-49')).toBe(true));
        expect(result.current.items.some(({ item }) => item.kind === 'ui')).toBe(true);
        load();
        await waitFor(() => expect(result.current.items.some(({ item }) => item.uid === 'folder-99')).toBe(true));
        load();
        await waitFor(() => expect(result.current.items.some(({ item }) => item.uid === 'folder-102')).toBe(true));
        expect(result.current.items[1].item).toMatchObject({ title: 'Folder 000' });
        expect(result.current.items.at(-1)?.item).toMatchObject({ title: 'Folder 102' });
        expect(result.current.items.some(({ item }) => item.kind === 'ui')).toBe(false);
        load();
        expect(requests).toEqual([0, 50, 100]);
        unmount();
      }
    );
  });

  describe.each([
    // foldersAppPlatformAPI enabled
    true,
    // foldersAppPlatformAPI disabled
    false,
  ])('foldersAppPlatformAPI feature toggle set to %s', (featureToggleState) => {
    beforeEach(() => {
      setTestFlags({ foldersAppPlatformAPI: featureToggleState });
    });

    // The act wrap is needed because resetting fires OpenFeature events while the hook is mounted.
    afterEach(async () => {
      await act(async () => {
        setTestFlags({});
      });
    });

    it('returns data', async () => {
      const [_dashboardsContainer, ...items] = await testFn();

      const sortedItemTitles = items.map((item) => (item.item as DashboardViewItem).title).sort();
      const expectedTitles = [folderA.item.title, folderB.item.title, folderC.item.title, folderD.item.title];
      if (featureToggleState) {
        // In new API mode we create the "Shared with me" folder under the root folder in the front end so it's always
        // present. In the legacy one I assume it came from backend and so isn't present if the fixtures don't include
        // it
        expectedTitles.push('Shared with me');
      }
      expectedTitles.sort();

      expect(sortedItemTitles).toEqual(expectedTitles);
    });

    it('uses custom root folder display name when rootFolderItem is provided', async () => {
      const { result } = renderHook(
        () =>
          useFoldersQuery({
            isBrowsing: true,
            openFolders: {},
            rootFolderItem: getCustomRootFolderItem({
              title: 'Test Repo',
              managedBy: ManagerKind.Repo,
              uid: '',
            }),
          }),
        { wrapper }
      );

      // Test that root folder item uses the custom display name
      expect(result.current.items[0]).toEqual(
        getCustomRootFolderItem({
          title: 'Test Repo',
          managedBy: ManagerKind.Repo,
          uid: '',
        })
      );
    });
  });
});

async function testFn() {
  const { result } = renderHook(
    () =>
      useFoldersQuery({
        isBrowsing: true,
        openFolders: {},
      }),
    { wrapper }
  );

  expect(result.current.items[0]).toEqual(getRootFolderItem());
  expect(result.current.isLoading).toBe(false);

  act(() => {
    result.current.requestNextPage(undefined);
  });

  expect(result.current.isLoading).toBe(true);

  await waitFor(() => {
    return expect(result.current.isLoading).toBe(false);
  });

  return result.current.items;
}
