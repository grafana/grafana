import { ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { checkFilesForMissingMetadata, getFolderMetadataPath } from './folderMetadata';

function makeResource(overrides: Partial<ResourceListItem> & { path: string }): ResourceListItem {
  return {
    name: 'uid',
    group: 'folder.grafana.app',
    resource: 'folders',
    hash: '',
    folder: '',
    ...overrides,
  };
}

describe('getFolderMetadataPath', () => {
  it('returns _folder.json for root (no path)', () => {
    expect(getFolderMetadataPath()).toBe('_folder.json');
    expect(getFolderMetadataPath('')).toBe('_folder.json');
  });

  it('appends _folder.json to a given path', () => {
    expect(getFolderMetadataPath('dashboards')).toBe('dashboards/_folder.json');
    expect(getFolderMetadataPath('a/b')).toBe('a/b/_folder.json');
  });
});

describe('checkFilesForMissingMetadata', () => {
  it('returns false when there are no resources', () => {
    expect(checkFilesForMissingMetadata([{ path: 'dashboard.json' }], [])).toBe(false);
  });

  it('returns false when there are no files and no resources', () => {
    expect(checkFilesForMissingMetadata([], [])).toBe(false);
  });

  it('ignores non-folder resources', () => {
    const files = [{ path: 'subfolder/dashboard.json' }];
    const resources = [makeResource({ path: 'subfolder/dashboard.json', resource: 'dashboards', name: 'dash' })];
    expect(checkFilesForMissingMetadata(files, resources)).toBe(false);
  });

  it('returns false when provisioned folder has _folder.json', () => {
    const files = [{ path: 'subfolder/_folder.json' }, { path: 'subfolder/dashboard.json' }];
    const resources = [makeResource({ path: 'subfolder' })];
    expect(checkFilesForMissingMetadata(files, resources)).toBe(false);
  });

  it('returns true when provisioned folder is missing _folder.json', () => {
    const files = [{ path: 'subfolder/dashboard.json' }];
    const resources = [makeResource({ path: 'subfolder' })];
    expect(checkFilesForMissingMetadata(files, resources)).toBe(true);
  });

  it('returns true when any provisioned folder is missing _folder.json', () => {
    const files = [{ path: 'a/_folder.json' }, { path: 'a/b/dashboard.json' }];
    const resources = [makeResource({ path: 'a', name: 'a' }), makeResource({ path: 'a/b', name: 'b' })];
    expect(checkFilesForMissingMetadata(files, resources)).toBe(true);
  });

  it('returns false when all nested provisioned folders have _folder.json', () => {
    const files = [{ path: 'a/_folder.json' }, { path: 'a/b/_folder.json' }, { path: 'a/b/dashboard.json' }];
    const resources = [makeResource({ path: 'a', name: 'a' }), makeResource({ path: 'a/b', name: 'b' })];
    expect(checkFilesForMissingMetadata(files, resources)).toBe(false);
  });

  it('does not flag folders that are not provisioned (no false positives)', () => {
    const files = [{ path: 'subfolder/dashboard.json' }];
    const resources = [makeResource({ path: 'subfolder/dashboard.json', resource: 'dashboards', name: 'dash' })];
    expect(checkFilesForMissingMetadata(files, resources)).toBe(false);
  });

  it('handles resources with missing path', () => {
    const files = [{ path: 'x/_folder.json' }];
    const resources = [makeResource({ path: '' as string })];
    expect(checkFilesForMissingMetadata(files, resources)).toBe(false);
  });

  it('handles files with missing path', () => {
    const files = [{ path: undefined }, { path: 'subfolder/_folder.json' }];
    const resources = [makeResource({ path: 'subfolder' })];
    expect(checkFilesForMissingMetadata(files, resources)).toBe(false);
  });
});
