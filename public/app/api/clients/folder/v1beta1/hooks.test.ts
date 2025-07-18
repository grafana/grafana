import { QueryStatus } from '@reduxjs/toolkit/query';
import { renderHook } from '@testing-library/react';

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

import { useGetFolderQuery, useGetFolderParentsQuery, useGetFolderAccessQuery } from './index';

// Mocks for the hooks used inside useGetFolderQueryFacade
jest.mock('./index', () => ({
  useGetFolderQuery: jest.fn(),
  useGetFolderParentsQuery: jest.fn(),
  useGetFolderAccessQuery: jest.fn(),
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

const mockAccess = {
  data: {
    canAdmin: true,
    canDelete: true,
    canEdit: true,
    canSave: true,
    accessControl: [],
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
  beforeEach(() => {
    (useGetFolderQuery as jest.Mock).mockReturnValue(mockFolder);
    (useGetFolderParentsQuery as jest.Mock).mockReturnValue(mockParents);
    (useGetFolderAccessQuery as jest.Mock).mockReturnValue(mockAccess);
    (useGetDisplayMappingQuery as jest.Mock).mockReturnValue(mockUserDisplay);
  });

  it('merges multiple responses into a single FolderDTO-like object', () => {
    const { result } = renderHook(() => useGetFolderQueryFacade('folder-uid'));
    expect(result.current.data).toMatchObject({
      canAdmin: true,
      canDelete: true,
      canEdit: true,
      canSave: true,
      accessControl: [],
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
      parents: [
        {
          title: 'Parent Folder',
          uid: 'parent-uid',
          url: '/grafana/dashboards/f/parent-uid/parent-folder',
        },
      ],
    });
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
