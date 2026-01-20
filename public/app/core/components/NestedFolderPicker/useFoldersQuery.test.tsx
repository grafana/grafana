import { ReactNode } from 'react';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import * as runtime from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { ManagerKind } from 'app/features/apiserver/types';

import { DashboardViewItem } from '../../../features/search/types';

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
  let configBackup: runtime.GrafanaBootConfig;

  beforeAll(() => {
    configBackup = { ...runtime.config };
  });

  afterAll(() => {
    runtime.config.featureToggles = configBackup.featureToggles;
  });

  describe.each([
    // foldersAppPlatformAPI enabled
    true,
    // foldersAppPlatformAPI disabled
    false,
  ])('foldersAppPlatformAPI feature toggle set to %s', (featureToggleState) => {
    it('returns data', async () => {
      runtime.config.featureToggles.foldersAppPlatformAPI = featureToggleState;
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
      runtime.config.featureToggles.foldersAppPlatformAPI = featureToggleState;
      const { result } = renderHook(
        () =>
          useFoldersQuery({
            isBrowsing: true,
            openFolders: {},
            rootFolderItem: getCustomRootFolderItem({
              title: 'Test Repo',
              managedBy: ManagerKind.Repo,
            }),
          }),
        { wrapper }
      );

      // Test that root folder item uses the custom display name
      expect(result.current.items[0]).toEqual(
        getCustomRootFolderItem({
          title: 'Test Repo',
          managedBy: ManagerKind.Repo,
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
