import { ReactNode } from 'react';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { GrafanaConfig } from '@grafana/data';
import * as runtime from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardViewItem } from '../../../features/search/types';

import { useFoldersQuery } from './useFoldersQuery';
import { getRootFolderItem } from './utils';

const [_, { folderA, folderB, folderC }] = getFolderFixtures();

runtime.setBackendSrv(backendSrv);
setupMockServer();

const wrapper = ({ children }: { children: ReactNode }) => {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  return <ProviderWrapper>{children}</ProviderWrapper>;
};

describe('useFoldersQuery', () => {
  let configBackup: GrafanaConfig;

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
    it('returns data using legacy api', async () => {
      runtime.config.featureToggles.foldersAppPlatformAPI = featureToggleState;
      const [_dashboardsContainer, ...items] = await testFn();

      const sortedItemTitles = items.map((item) => (item.item as DashboardViewItem).title).sort();
      const expectedTitles = [folderA.item.title, folderB.item.title, folderC.item.title].sort();

      expect(sortedItemTitles).toEqual(expectedTitles);
    });
  });
});

async function testFn() {
  const { result } = renderHook(() => useFoldersQuery(true, {}), { wrapper });

  expect(result.current.items[0]).toEqual(getRootFolderItem());
  expect(result.current.isLoading).toBe(false);

  act(() => {
    result.current.requestNextPage(undefined);
  });

  expect(result.current.isLoading).toBe(true);

  await waitFor(() => {
    const withoutPaginationPlaceholders = result.current.items.filter((item) => item.item.kind !== 'ui');
    return expect(withoutPaginationPlaceholders.length).toBeGreaterThan(1);
  });

  return result.current.items;
}
