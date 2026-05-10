import { type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { type TreeItem } from '../types';

import { buildTree, filterTree, flattenTree, getItemType, getStatus, mergeFilesAndResources } from './treeUtils';

// Mock data
const mockFileDetails = {
  path: 'dashboards/my-dashboard.json',
  size: '1234',
  hash: 'abc123def456',
};

const mockResource: ResourceListItem = {
  path: 'dashboards/my-dashboard.json',
  name: 'dashboard-uid',
  title: 'My Dashboard',
  resource: 'dashboards',
  hash: 'abc123def456',
  folder: '',
  group: 'dashboard.grafana.app',
};

const mockFolderResource: ResourceListItem = {
  path: 'dashboards',
  name: 'folder-uid',
  title: 'Dashboards Folder',
  resource: 'folders',
  hash: 'xyz789',
  folder: '',
  group: 'folder.grafana.app',
};

describe('mergeFilesAndResources', () => {
  it('should merge files and resources by path', () => {
    const files = [mockFileDetails];
    const resources = [mockResource];

    const result = mergeFilesAndResources(files, resources);

    // 2 items: the file + inferred folder 'dashboards'
    expect(result).toHaveLength(2);
    const file = result.find((r) => r.path === 'dashboards/my-dashboard.json');
    expect(file?.file).toEqual(mockFileDetails);
    expect(file?.resource).toEqual(mockResource);

    const folder = result.find((r) => r.path === 'dashboards');
    expect(folder?.file).toEqual({ path: 'dashboards', hash: '' });
    expect(folder?.resource).toBeUndefined();
  });

  it('should handle files without matching resources', () => {
    const files = [{ path: 'orphan-file.json', size: '100', hash: 'hash1' }];
    const resources: ResourceListItem[] = [];

    const result = mergeFilesAndResources(files, resources);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('orphan-file.json');
    expect(result[0].file).toBeDefined();
    expect(result[0].resource).toBeUndefined();
  });

  it('should handle resources without matching files', () => {
    const files: unknown[] = [];
    const resources = [mockResource];

    const result = mergeFilesAndResources(files, resources);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('dashboards/my-dashboard.json');
    expect(result[0].file).toBeUndefined();
    expect(result[0].resource).toEqual(mockResource);
  });

  it('should handle empty arrays', () => {
    const result = mergeFilesAndResources([], []);

    expect(result).toHaveLength(0);
  });

  it('should filter out invalid file objects', () => {
    const files = [
      mockFileDetails,
      { invalid: 'object' }, // Missing path and hash
      null,
      undefined,
      'string',
    ];
    const resources: ResourceListItem[] = [];

    const result = mergeFilesAndResources(files, resources);

    // 2 items: the file + inferred folder 'dashboards'
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.path === 'dashboards/my-dashboard.json')).toBeDefined();
    expect(result.find((r) => r.path === 'dashboards')).toBeDefined();
  });

  it('should skip resources with empty path (root)', () => {
    const files: unknown[] = [];
    const rootResource = { ...mockResource, path: '' };
    const resources = [rootResource, mockResource];

    const result = mergeFilesAndResources(files, resources);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('dashboards/my-dashboard.json');
  });

  it('should handle folder in resources but not in files', () => {
    const files = [
      {
        path: 'new-dashboard-2025-10-24-NKAPX.json',
        hash: '78383507641a9fe0c6dc715bf81989c2732e84df',
      },
    ];
    const resources: ResourceListItem[] = [
      {
        path: 'new-dashboard-2025-10-24-NKAPX.json',
        group: 'dashboard.grafana.app',
        resource: 'dashboards',
        name: 'dcf20b2odenyf4d',
        hash: '78383507641a9fe0c6dc715bf81989c2732e84df',
        title: 'v2 dashboard',
        folder: 'repository-89cac64',
      },
      {
        path: 'unsynced-folder',
        group: 'folder.grafana.app',
        resource: 'folders',
        name: 'unsynced-folder-pyqothnbi8kcxjvo7tnujum7',
        hash: '',
        title: 'unsynced-folder',
        folder: 'repository-89cac64',
      },
    ];

    const result = mergeFilesAndResources(files, resources);

    expect(result).toHaveLength(2);

    const dashboard = result.find((r) => r.path === 'new-dashboard-2025-10-24-NKAPX.json');
    expect(dashboard?.file).toBeDefined();
    expect(dashboard?.resource).toBeDefined();

    const folder = result.find((r) => r.path === 'unsynced-folder');
    expect(folder?.file).toBeUndefined();
    expect(folder?.resource).toBeDefined();
    expect(folder?.resource?.resource).toBe('folders');
  });
});

describe('getItemType', () => {
  it('should return Dashboard for dashboard resources', () => {
    const result = getItemType('dashboards/test.json', mockResource);

    expect(result).toBe('Dashboard');
  });

  it('should return Folder for folder resources', () => {
    const result = getItemType('dashboards', mockFolderResource);

    expect(result).toBe('Folder');
  });

  it('should return File for unsynced files regardless of extension', () => {
    const result = getItemType('some/path/file.json', undefined);

    expect(result).toBe('File');
  });

  it('should return File for non-JSON paths without resource', () => {
    const result = getItemType('some/path/file.txt', undefined);

    expect(result).toBe('File');
  });

  it('should return File when resource type is unknown', () => {
    const unknownResource = {
      ...mockResource,
      resource: 'unknown-type',
    };

    const result = getItemType('some/path', unknownResource);

    expect(result).toBe('File');
  });
});

describe('getStatus', () => {
  it('should return synced when both hashes exist and match', () => {
    expect(getStatus('abc123', 'abc123')).toBe('synced');
  });

  it('should return pending when both hashes exist but differ', () => {
    expect(getStatus('abc123', 'xyz789')).toBe('pending');
  });

  it('should return pending when only file hash exists', () => {
    expect(getStatus('abc123', undefined)).toBe('pending');
  });

  it('should return pending when only resource hash exists', () => {
    expect(getStatus(undefined, 'abc123')).toBe('pending');
  });

  it('should return pending when neither hash exists', () => {
    expect(getStatus(undefined, undefined)).toBe('pending');
  });

  it('should return synced for inferred folder (empty file hash) with resource', () => {
    // Empty hash means folder was inferred from file paths
    expect(getStatus('', 'abc123')).toBe('synced');
  });

  it('should return pending for inferred folder (empty file hash) without resource', () => {
    expect(getStatus('', undefined)).toBe('pending');
  });
});

describe('buildTree', () => {
  it('should build tree with folder hierarchy', () => {
    const mergedItems = [
      { path: 'folder', file: { path: 'folder', hash: '' } },
      { path: 'folder/subfolder', file: { path: 'folder/subfolder', hash: '' } },
      { path: 'folder/subfolder/file.json', file: { path: 'folder/subfolder/file.json', size: '100', hash: 'h1' } },
    ];

    const result = buildTree(mergedItems);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('Folder');
    expect(result[0].path).toBe('folder');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].type).toBe('Folder');
    expect(result[0].children[0].path).toBe('folder/subfolder');
  });

  it('should place files under correct parent folders', () => {
    const mergedItems = [
      { path: 'folder', file: { path: 'folder', hash: '' } },
      { path: 'folder/file.txt', file: { path: 'folder/file.txt', size: '100', hash: 'h1' } },
    ];

    const result = buildTree(mergedItems);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('folder');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].path).toBe('folder/file.txt');
    expect(result[0].children[0].type).toBe('File');
  });

  it('should sort folders before files', () => {
    const mergedItems = [
      { path: 'file.txt', file: { path: 'file.txt', size: '100', hash: 'h1' } },
      { path: 'folder', file: { path: 'folder', hash: '' } },
      { path: 'folder/nested.txt', file: { path: 'folder/nested.txt', size: '100', hash: 'h2' } },
    ];

    const result = buildTree(mergedItems);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('Folder');
    expect(result[0].title).toBe('folder');
    expect(result[1].type).toBe('File');
    expect(result[1].title).toBe('file.txt');
  });

  it('should sort alphabetically within same type', () => {
    const mergedItems = [
      { path: 'zebra.json', file: { path: 'zebra.json', size: '100', hash: 'h1' } },
      { path: 'apple.json', file: { path: 'apple.json', size: '100', hash: 'h2' } },
      { path: 'mango.json', file: { path: 'mango.json', size: '100', hash: 'h3' } },
    ];

    const result = buildTree(mergedItems);

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('apple.json');
    expect(result[1].title).toBe('mango.json');
    expect(result[2].title).toBe('zebra.json');
  });

  it('should handle root-level items', () => {
    const mergedItems = [{ path: 'root-file.txt', file: { path: 'root-file.txt', size: '100', hash: 'h1' } }];

    const result = buildTree(mergedItems);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('root-file.txt');
    expect(result[0].type).toBe('File');
  });

  it('should handle deeply nested paths', () => {
    const mergedItems = [
      { path: 'a', file: { path: 'a', hash: '' } },
      { path: 'a/b', file: { path: 'a/b', hash: '' } },
      { path: 'a/b/c', file: { path: 'a/b/c', hash: '' } },
      { path: 'a/b/c/d', file: { path: 'a/b/c/d', hash: '' } },
      { path: 'a/b/c/d/e', file: { path: 'a/b/c/d/e', hash: '' } },
      { path: 'a/b/c/d/e/file.txt', file: { path: 'a/b/c/d/e/file.txt', size: '100', hash: 'h1' } },
    ];

    const result = buildTree(mergedItems);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('a');

    // Traverse to the deepest file
    let current = result[0];
    const expectedPaths = ['a', 'a/b', 'a/b/c', 'a/b/c/d', 'a/b/c/d/e'];
    for (let i = 0; i < expectedPaths.length; i++) {
      expect(current.path).toBe(expectedPaths[i]);
      expect(current.type).toBe('Folder');
      if (i < expectedPaths.length - 1) {
        current = current.children[0];
      }
    }

    // Check the file is in the last folder
    const lastFolder = current;
    expect(lastFolder.children).toHaveLength(1);
    expect(lastFolder.children[0].path).toBe('a/b/c/d/e/file.txt');
    expect(lastFolder.children[0].type).toBe('File');
  });

  it('should handle empty input', () => {
    const result = buildTree([]);

    expect(result).toHaveLength(0);
  });

  it('should use resource info for folder nodes when available', () => {
    const mergedItems = [
      { path: 'dashboards', resource: mockFolderResource },
      { path: 'dashboards/test.json', resource: mockResource },
    ];

    const result = buildTree(mergedItems);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Dashboards Folder');
    expect(result[0].resourceName).toBe('folder-uid');
  });

  it('should set synced status when file and resource hashes match', () => {
    const mergedItems = [
      {
        path: 'dashboard.json',
        file: { path: 'dashboard.json', size: '100', hash: 'abc123def456' },
        resource: mockResource, // mockResource has hash: 'abc123def456'
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].status).toBe('synced');
  });

  it('should set pending status when file and resource hashes differ', () => {
    const mergedItems = [
      {
        path: 'dashboard.json',
        file: { path: 'dashboard.json', size: '100', hash: 'different-hash' },
        resource: mockResource,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].status).toBe('pending');
  });

  it('should not set status for non-JSON files', () => {
    const mergedItems = [{ path: 'file.txt', file: { path: 'file.txt', size: '100', hash: 'h1' } }];

    const result = buildTree(mergedItems);

    expect(result[0].status).toBeUndefined();
  });

  it('should show unsynced JSON files as File type with pending status', () => {
    const mergedItems = [{ path: 'dashboard.json', file: { path: 'dashboard.json', size: '100', hash: 'h1' } }];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('File');
    expect(result[0].status).toBe('pending');
  });

  it('should set pending status when only resource exists', () => {
    const mergedItems = [{ path: 'dashboard.json', resource: mockResource }];

    const result = buildTree(mergedItems);

    expect(result[0].status).toBe('pending');
  });

  it('should set folder status to synced when all children are synced', () => {
    const syncedResource = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      { path: 'folder', file: { path: 'folder', hash: '' }, resource: mockFolderResource },
      {
        path: 'folder/_folder.json',
        file: { path: 'folder/_folder.json', size: '200', hash: mockFolderResource.hash },
      },
      {
        path: 'folder/dashboard1.json',
        file: { path: 'folder/dashboard1.json', size: '100', hash: 'matching-hash' },
        resource: syncedResource,
      },
      {
        path: 'folder/dashboard2.json',
        file: { path: 'folder/dashboard2.json', size: '100', hash: 'matching-hash' },
        resource: { ...syncedResource, name: 'other-uid' },
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].resourceName).toBe('folder-uid');
    expect(result[0].status).toBe('synced');
  });

  it('should set folder status to pending when any child is pending', () => {
    const syncedResource = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      { path: 'folder', resource: mockFolderResource },
      {
        path: 'folder/dashboard1.json',
        file: { path: 'folder/dashboard1.json', size: '100', hash: 'matching-hash' },
        resource: syncedResource,
      },
      {
        path: 'folder/dashboard2.json',
        file: { path: 'folder/dashboard2.json', size: '100', hash: 'different-hash' },
        resource: syncedResource,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].resourceName).toBe('folder-uid');
    expect(result[0].status).toBe('pending');
  });

  it('should propagate pending status from nested folders', () => {
    const syncedResource = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      { path: 'parent', file: { path: 'parent', hash: '' } },
      { path: 'parent/child', file: { path: 'parent/child', hash: '' } },
      {
        path: 'parent/child/dashboard.json',
        file: { path: 'parent/child/dashboard.json', size: '100', hash: 'different-hash' },
        resource: syncedResource,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].path).toBe('parent');
    expect(result[0].status).toBe('pending');
    expect(result[0].children[0].path).toBe('parent/child');
    expect(result[0].children[0].status).toBe('pending');
  });

  it('should set pending status for unsynced folders with no dashboard children', () => {
    const mergedItems = [
      {
        path: 'unsynced-folder',
        resource: {
          path: 'unsynced-folder',
          group: 'folder.grafana.app',
          resource: 'folders',
          name: 'unsynced-folder-pyqothnbi8kcxjvo7tnujum7',
          hash: '',
          title: 'unsynced-folder',
          folder: 'repository-89cac64',
        },
      },
      {
        path: 'new-dashboard-2025-10-24-NKAPX.json',
        file: {
          path: 'new-dashboard-2025-10-24-NKAPX.json',
          hash: '78383507641a9fe0c6dc715bf81989c2732e84df',
        },
        resource: {
          path: 'new-dashboard-2025-10-24-NKAPX.json',
          group: 'dashboard.grafana.app',
          resource: 'dashboards',
          name: 'dcf20b2odenyf4d',
          hash: '78383507641a9fe0c6dc715bf81989c2732e84df',
          title: 'v2 dashboard',
          folder: 'repository-89cac64',
        },
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].status).toBe('pending');
  });

  it('should set pending status for folder in resources but not in files', () => {
    // Folder only exists in resources (e.g., deleted from repo but not synced yet)
    const mergedItems = [
      { path: 'folder', resource: mockFolderResource },
      { path: 'folder/file.txt', file: { path: 'folder/file.txt', size: '100', hash: 'h1' } },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].resourceName).toBe('folder-uid');
    expect(result[0].status).toBe('pending');
  });

  it('should set synced status for folder inferred from files with matching resource', () => {
    // Folder inferred from file paths AND exists in resources with its metadata file
    // matching the resource hash → synced.
    const syncedResource = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      { path: 'folder', file: { path: 'folder', hash: '' }, resource: mockFolderResource },
      {
        path: 'folder/_folder.json',
        file: { path: 'folder/_folder.json', size: '200', hash: mockFolderResource.hash },
      },
      {
        path: 'folder/dashboard.json',
        file: { path: 'folder/dashboard.json', size: '100', hash: 'matching-hash' },
        resource: syncedResource,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].resourceName).toBe('folder-uid');
    expect(result[0].status).toBe('synced');
  });

  it('should set missingFolderMetadata to true for provisioned folder without _folder.json', () => {
    const mergedItems = [
      { path: 'dashboards', file: { path: 'dashboards', hash: '' }, resource: mockFolderResource },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'abc123def456' },
        resource: mockResource,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].missingFolderMetadata).toBe(true);
  });

  it('should set missingFolderMetadata to false for provisioned folder with _folder.json', () => {
    const mergedItems = [
      { path: 'dashboards', file: { path: 'dashboards', hash: '' }, resource: mockFolderResource },
      { path: 'dashboards/_folder.json', file: { path: 'dashboards/_folder.json', size: '200', hash: 'meta123' } },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'abc123def456' },
        resource: mockResource,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].missingFolderMetadata).toBe(false);
  });

  it('should mark _folder.json synced when its hash matches the parent folder resource hash', () => {
    // The folder resource hash IS the synced metadata hash, so _folder.json is compared
    // against its parent folder's resource hash (not its own resource — it has none).
    const syncedDashboard = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      { path: 'dashboards', file: { path: 'dashboards', hash: '' }, resource: mockFolderResource },
      {
        path: 'dashboards/_folder.json',
        file: { path: 'dashboards/_folder.json', size: '200', hash: mockFolderResource.hash },
      },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'matching-hash' },
        resource: syncedDashboard,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].status).toBe('synced');
    const metadataNode = result[0].children.find((c) => c.path === 'dashboards/_folder.json');
    expect(metadataNode?.status).toBe('synced');
  });

  it('should mark _folder.json and parent folder pending when _folder.json was updated remotely', () => {
    // File hash differs from the folder resource hash → metadata file was updated in the
    // remote repo but not yet synced. Both the file row and the parent folder must reflect this.
    const syncedDashboard = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      { path: 'dashboards', file: { path: 'dashboards', hash: '' }, resource: mockFolderResource },
      {
        path: 'dashboards/_folder.json',
        file: { path: 'dashboards/_folder.json', size: '200', hash: 'updated-meta-hash' },
      },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'matching-hash' },
        resource: syncedDashboard,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].status).toBe('pending');
    const metadataNode = result[0].children.find((c) => c.path === 'dashboards/_folder.json');
    expect(metadataNode?.status).toBe('pending');
  });

  it('should mark _folder.json and parent folder pending when _folder.json was added but folder has no metadata hash yet', () => {
    // File present in repo but parent folder resource has empty hash → freshly added,
    // not yet reflected on the resource.
    const folderWithoutMetadataHash = { ...mockFolderResource, hash: '' };
    const syncedDashboard = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      { path: 'dashboards', file: { path: 'dashboards', hash: '' }, resource: folderWithoutMetadataHash },
      {
        path: 'dashboards/_folder.json',
        file: { path: 'dashboards/_folder.json', size: '200', hash: 'new-meta-hash' },
      },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'matching-hash' },
        resource: syncedDashboard,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].status).toBe('pending');
    const metadataNode = result[0].children.find((c) => c.path === 'dashboards/_folder.json');
    expect(metadataNode?.status).toBe('pending');
  });

  it('should mark parent folder pending when _folder.json was removed remotely but folder resource still has metadata hash', () => {
    // File missing from the remote repo but folder resource still has a non-empty hash →
    // metadata was previously synced and the file was deleted. The folder must reflect pending.
    const syncedDashboard = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      { path: 'dashboards', file: { path: 'dashboards', hash: '' }, resource: mockFolderResource },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'matching-hash' },
        resource: syncedDashboard,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].missingFolderMetadata).toBe(true);
    expect(result[0].status).toBe('pending');
  });

  it('should keep parent folder synced when _folder.json is missing and folder has no metadata hash (never had metadata)', () => {
    // Folder resource hash empty → never had metadata. Missing _folder.json is the
    // expected state; folder should not be flagged pending on this account.
    const folderWithoutMetadataHash = { ...mockFolderResource, hash: '' };
    const syncedDashboard = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      { path: 'dashboards', file: { path: 'dashboards', hash: '' }, resource: folderWithoutMetadataHash },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'matching-hash' },
        resource: syncedDashboard,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].missingFolderMetadata).toBe(true);
    expect(result[0].status).toBe('synced');
  });

  it('should mark _folder.json and inferred parent folder pending when parent has no resource', () => {
    // Matrix row 6: parent folder is inferred from file paths but not yet provisioned
    // (no resource), so getFolderMetadataResourceHash returns undefined → pending row,
    // pending folder via child propagation.
    const syncedDashboard = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      // Inferred folder (no resource) — same shape mergeFilesAndResources produces.
      { path: 'dashboards', file: { path: 'dashboards', hash: '' } },
      {
        path: 'dashboards/_folder.json',
        file: { path: 'dashboards/_folder.json', size: '200', hash: 'some-meta-hash' },
      },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'matching-hash' },
        resource: syncedDashboard,
      },
    ];

    const result = buildTree(mergedItems);

    const folder = result.find((n) => n.path === 'dashboards');
    expect(folder?.type).toBe('Folder');
    expect(folder?.resourceName).toBeUndefined();
    expect(folder?.status).toBe('pending');
    const metadataNode = folder?.children.find((c) => c.path === 'dashboards/_folder.json');
    expect(metadataNode?.status).toBe('pending');
  });

  it('should mark folder pending when _folder.json is synced but a sibling dashboard is pending', () => {
    // Matrix row 9: a synced metadata file does not save the parent folder when another
    // child (a dashboard) is out of sync — the dashboard's pending status propagates.
    const driftedDashboard = { ...mockResource, hash: 'resource-hash' };
    const mergedItems = [
      { path: 'dashboards', file: { path: 'dashboards', hash: '' }, resource: mockFolderResource },
      {
        path: 'dashboards/_folder.json',
        file: { path: 'dashboards/_folder.json', size: '200', hash: mockFolderResource.hash },
      },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'file-hash-drifted' },
        resource: driftedDashboard,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].status).toBe('pending');
    const metadataNode = result[0].children.find((c) => c.path === 'dashboards/_folder.json');
    expect(metadataNode?.status).toBe('synced');
    const dashboardNode = result[0].children.find((c) => c.path === 'dashboards/my-dashboard.json');
    expect(dashboardNode?.status).toBe('pending');
  });

  it('should evaluate sibling folders independently when one has pending metadata and the other is fully synced', () => {
    // Matrix row 12: a pending _folder.json in one folder must not bleed into a sibling
    // folder that is fully synced.
    const folderASynced: ResourceListItem = {
      ...mockFolderResource,
      path: 'folder-a',
      name: 'folder-a-uid',
      hash: 'meta-a',
    };
    const folderBSynced: ResourceListItem = {
      ...mockFolderResource,
      path: 'folder-b',
      name: 'folder-b-uid',
      hash: 'meta-b',
    };
    const dashboardA = { ...mockResource, name: 'dash-a', hash: 'dash-a-hash' };
    const dashboardB = { ...mockResource, name: 'dash-b', hash: 'dash-b-hash' };
    const mergedItems = [
      { path: 'folder-a', file: { path: 'folder-a', hash: '' }, resource: folderASynced },
      // folder-a metadata is updated remotely (file hash differs from resource hash) → pending
      {
        path: 'folder-a/_folder.json',
        file: { path: 'folder-a/_folder.json', size: '200', hash: 'meta-a-drifted' },
      },
      {
        path: 'folder-a/dashboard.json',
        file: { path: 'folder-a/dashboard.json', size: '100', hash: 'dash-a-hash' },
        resource: dashboardA,
      },
      // folder-b is fully synced (metadata file hash matches resource hash)
      { path: 'folder-b', file: { path: 'folder-b', hash: '' }, resource: folderBSynced },
      {
        path: 'folder-b/_folder.json',
        file: { path: 'folder-b/_folder.json', size: '200', hash: folderBSynced.hash },
      },
      {
        path: 'folder-b/dashboard.json',
        file: { path: 'folder-b/dashboard.json', size: '100', hash: 'dash-b-hash' },
        resource: dashboardB,
      },
    ];

    const result = buildTree(mergedItems);

    const folderA = result.find((n) => n.path === 'folder-a');
    const folderB = result.find((n) => n.path === 'folder-b');
    expect(folderA?.status).toBe('pending');
    expect(folderB?.status).toBe('synced');
  });

  it('should compare root-level _folder.json against repository state (no parent resource)', () => {
    // Root-level _folder.json has no parent folder resource, so we cannot determine a
    // matching resource hash — it falls back to pending until the backend reports otherwise.
    const rootFolderResource: ResourceListItem = {
      ...mockFolderResource,
      path: 'dashboards',
      hash: 'meta-dashboards',
    };
    const syncedResource = { ...mockResource, hash: 'matching-hash' };
    const mergedItems = [
      { path: '_folder.json', file: { path: '_folder.json', size: '200', hash: 'meta-root' } },
      { path: 'dashboards', file: { path: 'dashboards', hash: '' }, resource: rootFolderResource },
      {
        path: 'dashboards/_folder.json',
        file: { path: 'dashboards/_folder.json', size: '200', hash: rootFolderResource.hash },
      },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'matching-hash' },
        resource: syncedResource,
      },
    ];

    const result = buildTree(mergedItems);

    const rootMetadata = result.find((n) => n.path === '_folder.json');
    expect(rootMetadata?.status).toBe('pending');
    const folder = result.find((n) => n.path === 'dashboards');
    expect(folder?.status).toBe('synced');
  });

  it('should not set missingFolderMetadata for inferred folders without a resource', () => {
    const mergedItems = [
      { path: 'dashboards', file: { path: 'dashboards', hash: '' } },
      {
        path: 'dashboards/my-dashboard.json',
        file: { path: 'dashboards/my-dashboard.json', size: '100', hash: 'abc123def456' },
        resource: mockResource,
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].type).toBe('Folder');
    expect(result[0].missingFolderMetadata).toBeUndefined();
  });

  it('should set missingFolderMetadata for root-level provisioned folder', () => {
    const rootFolderResource: ResourceListItem = {
      ...mockFolderResource,
      path: 'root-folder',
    };
    const mergedItems = [
      { path: 'root-folder', resource: rootFolderResource },
      { path: 'root-folder/file.json', file: { path: 'root-folder/file.json', size: '100', hash: 'h1' } },
    ];

    const result = buildTree(mergedItems);

    const folder = result.find((n) => n.path === 'root-folder');
    expect(folder?.type).toBe('Folder');
    expect(folder?.missingFolderMetadata).toBe(true);
  });

  it('should handle nested folders with mixed metadata presence', () => {
    const parentFolderResource: ResourceListItem = {
      ...mockFolderResource,
      path: 'parent',
      name: 'parent-uid',
      title: 'Parent',
    };
    const childFolderResource: ResourceListItem = {
      ...mockFolderResource,
      path: 'parent/child',
      name: 'child-uid',
      title: 'Child',
    };
    const mergedItems = [
      { path: 'parent', file: { path: 'parent', hash: '' }, resource: parentFolderResource },
      { path: 'parent/_folder.json', file: { path: 'parent/_folder.json', size: '100', hash: 'meta1' } },
      { path: 'parent/child', file: { path: 'parent/child', hash: '' }, resource: childFolderResource },
      // No parent/child/_folder.json — child is missing metadata
      {
        path: 'parent/child/dashboard.json',
        file: { path: 'parent/child/dashboard.json', size: '100', hash: 'h1' },
        resource: { ...mockResource, path: 'parent/child/dashboard.json', hash: 'h1' },
      },
    ];

    const result = buildTree(mergedItems);

    expect(result[0].path).toBe('parent');
    expect(result[0].missingFolderMetadata).toBe(false);

    const child = result[0].children.find((n) => n.path === 'parent/child');
    expect(child?.missingFolderMetadata).toBe(true);
  });
});

describe('flattenTree', () => {
  it('should flatten nested tree structure', () => {
    const tree: TreeItem[] = [
      {
        path: 'folder',
        title: 'Folder',
        type: 'Folder',
        level: 0,
        children: [
          {
            path: 'folder/file.json',
            title: 'file.json',
            type: 'File',
            level: 0,
            children: [],
          },
        ],
      },
    ];

    const result = flattenTree(tree);

    expect(result).toHaveLength(2);
    expect(result[0].item.path).toBe('folder');
    expect(result[1].item.path).toBe('folder/file.json');
  });

  it('should set correct level for each item', () => {
    const tree: TreeItem[] = [
      {
        path: 'folder',
        title: 'Folder',
        type: 'Folder',
        level: 0,
        children: [
          {
            path: 'folder/subfolder',
            title: 'Subfolder',
            type: 'Folder',
            level: 0,
            children: [
              {
                path: 'folder/subfolder/file.json',
                title: 'file.json',
                type: 'File',
                level: 0,
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const result = flattenTree(tree);

    expect(result).toHaveLength(3);
    expect(result[0].level).toBe(0);
    expect(result[1].level).toBe(1);
    expect(result[2].level).toBe(2);
  });

  it('should include all children', () => {
    const tree: TreeItem[] = [
      {
        path: 'folder',
        title: 'Folder',
        type: 'Folder',
        level: 0,
        children: [
          { path: 'folder/a.json', title: 'a.json', type: 'File', level: 0, children: [] },
          { path: 'folder/b.json', title: 'b.json', type: 'File', level: 0, children: [] },
          { path: 'folder/c.json', title: 'c.json', type: 'File', level: 0, children: [] },
        ],
      },
    ];

    const result = flattenTree(tree);

    expect(result).toHaveLength(4);
  });

  it('should handle empty tree', () => {
    const result = flattenTree([]);

    expect(result).toHaveLength(0);
  });
});

describe('filterTree', () => {
  const sampleTree: TreeItem[] = [
    {
      path: 'dashboards',
      title: 'Dashboards',
      type: 'Folder',
      level: 0,
      children: [
        {
          path: 'dashboards/monitoring.json',
          title: 'System Monitoring',
          type: 'Dashboard',
          level: 0,
          children: [],
        },
        {
          path: 'dashboards/sales.json',
          title: 'Sales Report',
          type: 'Dashboard',
          level: 0,
          children: [],
        },
      ],
    },
    {
      path: 'config.json',
      title: 'config.json',
      type: 'File',
      level: 0,
      children: [],
    },
  ];

  it('should return all items when query is empty', () => {
    const result = filterTree(sampleTree, '');

    expect(result).toEqual(sampleTree);
  });

  it('should filter by path (case-insensitive)', () => {
    const result = filterTree(sampleTree, 'MONITORING');

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('dashboards');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].path).toBe('dashboards/monitoring.json');
  });

  it('should filter by title (case-insensitive)', () => {
    const result = filterTree(sampleTree, 'sales report');

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('dashboards');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].title).toBe('Sales Report');
  });

  it('should include parent folders when child matches', () => {
    const result = filterTree(sampleTree, 'monitoring');

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('Folder');
    expect(result[0].path).toBe('dashboards');
    expect(result[0].children).toHaveLength(1);
  });

  it('should return empty array when nothing matches', () => {
    const result = filterTree(sampleTree, 'nonexistent');

    expect(result).toHaveLength(0);
  });

  it('should match folder itself if query matches folder name', () => {
    const result = filterTree(sampleTree, 'dashboards');

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('dashboards');
    // When folder matches, all children are included
    expect(result[0].children).toHaveLength(2);
  });

  it('should match root level items', () => {
    const result = filterTree(sampleTree, 'config');

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('config.json');
  });
});
