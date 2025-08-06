import { QueryStatus } from '@reduxjs/toolkit/query';
import { renderHook } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { useGetFolderQuery as useGetFolderQueryLegacy } from 'app/features/browse-dashboards/api/browseDashboardsAPI';

import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  AnnoKeyManagerKind,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  DeprecatedInternalId,
} from '../../../../features/apiserver/types';
import { useGetDisplayMappingQuery } from '../../iam/v0alpha1';

import { useGetFolderQueryFacade } from './hooks';

import { useGetFolderQuery, useGetFolderParentsQuery } from './index';

// Mocks for the hooks used inside useGetFolderQueryFacade
jest.mock('./index', () => ({
  useGetFolderQuery: jest.fn(),
  useGetFolderParentsQuery: jest.fn(),
}));

jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  useGetFolderQuery: jest.fn(),
}));

jest.mock('../../iam/v0alpha1', () => ({
  useGetDisplayMappingQuery: jest.fn(),
}));

// Mock config and constants
jest.mock('@grafana/runtime', () => {
  const runtime = jest.requireActual('@grafana/runtime');
  return {
    ...runtime,
    config: {
      ...runtime.config,
      featureToggles: {
        ...runtime.config.featureToggles,
        foldersAppPlatformAPI: true,
      },
      appSubUrl: '/grafana',
    },
  };
});

const mockFolder = {
  data: {
    metadata: {
      name: 'folder-uid',
      labels: { [DeprecatedInternalId]: '123' },
      annotations: {
        [AnnoKeyUpdatedBy]: 'user-1',
        [AnnoKeyCreatedBy]: 'user-2',
        [AnnoKeyFolder]: 'parent-uid',
        [AnnoKeyManagerKind]: 'user',
        [AnnoKeyUpdatedTimestamp]: '2024-01-01T00:00:00Z',
      },
      creationTimestamp: '2023-01-01T00:00:00Z',
      generation: 2,
    },
    spec: { title: 'Test Folder' },
  },
  ...getResponseAttributes(),
};

const mockParents = {
  data: { items: [{ name: 'parent-uid', title: 'Parent Folder' }] },
  ...getResponseAttributes(),
};

const mockLegacyResponse = {
  data: {
    id: 1,
    uid: 'uiduiduid',
    orgId: 1,
    title: 'bar',
    url: '/dashboards/f/uiduiduid/bar',
    hasAcl: false,
    canSave: true,
    canEdit: true,
    canAdmin: true,
    canDelete: true,
    createdBy: 'Anonymous',
    created: '2025-07-14T12:07:36+02:00',
    updatedBy: 'Anonymous',
    updated: '2025-07-15T18:01:36+02:00',
    version: 1,
    accessControl: {
      'dashboards.permissions:write': true,
      'dashboards:create': true,
    },
  },
  ...getResponseAttributes(),
};

const mockUserDisplay = {
  data: {
    keys: ['user-1', 'user-2'],
    display: [{ displayName: 'User One' }, { displayName: 'User Two' }],
  },
  ...getResponseAttributes(),
};

describe('useGetFolderQueryFacade', () => {
  const oldToggleValue = config.featureToggles.foldersAppPlatformAPI;

  afterAll(() => {
    config.featureToggles.foldersAppPlatformAPI = oldToggleValue;
  });

  beforeEach(() => {
    (useGetFolderQuery as jest.Mock).mockReturnValue(mockFolder);
    (useGetFolderParentsQuery as jest.Mock).mockReturnValue(mockParents);
    (useGetDisplayMappingQuery as jest.Mock).mockReturnValue(mockUserDisplay);
    (useGetFolderQueryLegacy as jest.Mock).mockReturnValue(mockLegacyResponse);
  });

  it('merges multiple responses into a single FolderDTO-like object if flag is true', () => {
    config.featureToggles.foldersAppPlatformAPI = true;
    const { result } = renderHook(() => useGetFolderQueryFacade('folder-uid'));
    expect(result.current.data).toMatchObject({
      canAdmin: true,
      canDelete: true,
      canEdit: true,
      canSave: true,
      created: '2023-01-01T00:00:00Z',
      createdBy: 'User Two',
      hasAcl: false,
      id: 123,
      parentUid: 'parent-uid',
      managedBy: 'user',
      title: 'Test Folder',
      uid: 'folder-uid',
      updated: '2024-01-01T00:00:00Z',
      updatedBy: 'User One',
      url: '/grafana/dashboards/f/folder-uid/test-folder',
      version: 2,
      accessControl: {
        'dashboards.permissions:write': true,
        'dashboards:create': true,
      },
      parents: [
        {
          title: 'Parent Folder',
          uid: 'parent-uid',
          url: '/grafana/dashboards/f/parent-uid/parent-folder',
        },
      ],
    });
  });

  it('returns legacy folder response if flag is false', () => {
    config.featureToggles.foldersAppPlatformAPI = false;
    const { result } = renderHook(() => useGetFolderQueryFacade('folder-uid'));
    expect(result.current.data).toMatchObject(mockLegacyResponse.data);
  });
});

function getResponseAttributes() {
  return {
    status: QueryStatus.fulfilled,
    isUninitialized: false,
    isLoading: false,
    isFetching: false,
    isSuccess: true,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
  };
}
