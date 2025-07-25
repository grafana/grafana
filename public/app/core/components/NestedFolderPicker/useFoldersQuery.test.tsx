import { act, renderHook } from '@testing-library/react';

import { GrafanaConfig } from '@grafana/data';
import * as runtime from '@grafana/runtime';
import { DashboardsTreeItem } from 'app/features/browse-dashboards/types';

import { DashboardViewItem } from '../../../features/search/types';

import { useFoldersQuery } from './useFoldersQuery';
import { getRootFolderItem } from './utils';

const PAGE_SIZE = 10;

const legacyResponse = {
  status: 'fulfilled',
  originalArgs: { parentUid: undefined, page: 1, limit: PAGE_SIZE, permission: 'Edit' },
  data: [{ title: 'Legacy Folder', uid: 'legacy1', managedBy: undefined }],
};
// Mock the legacy API client
jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => {
  const PAGE_SIZE = 10;
  return {
    PAGE_SIZE,
    browseDashboardsAPI: {
      endpoints: {
        listFolders: {
          select: jest.fn(() => () => legacyResponse),
          initiate: jest.fn(() => ({
            arg: { parentUid: undefined, page: 1, limit: PAGE_SIZE, permission: 'Edit' },
            unsubscribe: jest.fn(),
          })),
        },
      },
    },
  };
});

const appPlatfromResponse = {
  status: 'fulfilled',
  originalArgs: { name: 'general' },
  data: {
    items: [
      {
        metadata: { name: 'app1', annotations: {} },
        spec: { title: 'AppPlatform Folder' },
      },
    ],
  },
};

// Mock the appPlatform API client
jest.mock('app/api/clients/folder/v1beta1', () => ({
  folderAPIv1beta1: {
    endpoints: {
      getFolderChildren: {
        select: jest.fn(() => () => appPlatfromResponse),
        initiate: jest.fn((arg: unknown) => ({
          arg,
          unsubscribe: jest.fn(),
        })),
      },
    },
  },
}));

// Mock getPaginationPlaceholders to return empty array for simplicity
jest.mock('app/features/browse-dashboards/state/utils', () => ({
  getPaginationPlaceholders: jest.fn((): DashboardsTreeItem[] => []),
}));

// Mock useDispatch and useSelector to just pass through
jest.mock('app/types/store', () => {
  const mod = jest.requireActual('app/types/store');
  return {
    ...mod,
    useDispatch: () => (val: unknown) => val,
    useSelector: (selector: Function) => selector(),
  };
});

describe('useFoldersQuery', () => {
  let configBackup: GrafanaConfig;

  beforeAll(() => {
    configBackup = { ...runtime.config };
  });

  afterAll(() => {
    runtime.config.featureToggles = configBackup.featureToggles;
  });

  it('returns data using legacy api', () => {
    runtime.config.featureToggles.foldersAppPlatformAPI = false;
    const items = testFn();
    expect((items[1].item as DashboardViewItem).title).toBe('Legacy Folder');
  });

  it('returns appPlatform hook result when foldersAppPlatformAPI is on', () => {
    runtime.config.featureToggles.foldersAppPlatformAPI = true;
    const items = testFn();
    expect((items[1].item as DashboardViewItem).title).toBe('AppPlatform Folder');
  });
});

function testFn() {
  const { result } = renderHook(() => useFoldersQuery(true, {}));

  expect(result.current.items).toEqual([getRootFolderItem()]);
  expect(result.current.isLoading).toBe(false);
  act(() => {
    result.current.requestNextPage(undefined);
  });

  expect(result.current.items.length).toBe(2);
  return result.current.items;
}
