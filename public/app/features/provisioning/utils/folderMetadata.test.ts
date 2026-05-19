import { type Condition } from 'app/api/clients/provisioning/v0alpha1';

import {
  getFolderMetadataPath,
  getParentFolderResourceHash,
  hasMissingFolderMetadata,
  isFolderMetadataPath,
} from './folderMetadata';

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

describe('isFolderMetadataPath', () => {
  it('matches root-level _folder.json', () => {
    expect(isFolderMetadataPath('_folder.json')).toBe(true);
  });

  it('matches nested _folder.json', () => {
    expect(isFolderMetadataPath('dashboards/_folder.json')).toBe(true);
    expect(isFolderMetadataPath('a/b/c/_folder.json')).toBe(true);
  });

  it('does not match other JSON files', () => {
    expect(isFolderMetadataPath('dashboards/my-dashboard.json')).toBe(false);
    expect(isFolderMetadataPath('_folder.json.bak')).toBe(false);
    expect(isFolderMetadataPath('dashboards/folder.json')).toBe(false);
  });
});

describe('getParentFolderResourceHash', () => {
  const lookup = (entries: Record<string, string | undefined>) => (path: string) => entries[path];

  it('returns undefined for root-level _folder.json (no parent)', () => {
    expect(getParentFolderResourceHash('_folder.json', lookup({}))).toBeUndefined();
  });

  it("returns the parent folder's resource hash for nested _folder.json", () => {
    expect(getParentFolderResourceHash('dashboards/_folder.json', lookup({ dashboards: 'meta-hash' }))).toBe(
      'meta-hash'
    );
  });

  it('returns undefined when the parent folder has no resource hash', () => {
    expect(getParentFolderResourceHash('dashboards/_folder.json', lookup({}))).toBeUndefined();
  });

  it('walks deeply nested paths', () => {
    expect(getParentFolderResourceHash('a/b/c/_folder.json', lookup({ 'a/b/c': 'hash-c' }))).toBe('hash-c');
  });
});

function makeCondition(overrides: Partial<Condition> & { type: string; reason: string }): Condition {
  return {
    lastTransitionTime: '2024-01-01T00:00:00Z',
    message: '',
    observedGeneration: 1,
    status: 'True',
    ...overrides,
  };
}

describe('hasMissingFolderMetadata', () => {
  it('returns false when conditions is undefined', () => {
    expect(hasMissingFolderMetadata(undefined)).toBe(false);
  });

  it('returns false when conditions array is empty', () => {
    expect(hasMissingFolderMetadata([])).toBe(false);
  });

  it('returns false when PullStatus reason is Success', () => {
    const conditions: Condition[] = [makeCondition({ type: 'PullStatus', reason: 'Success' })];
    expect(hasMissingFolderMetadata(conditions)).toBe(false);
  });

  it('returns true when PullStatus reason is MissingFolderMetadata', () => {
    const conditions: Condition[] = [makeCondition({ type: 'PullStatus', reason: 'MissingFolderMetadata' })];
    expect(hasMissingFolderMetadata(conditions)).toBe(true);
  });

  it('returns false when a non-PullStatus condition has MissingFolderMetadata reason', () => {
    const conditions: Condition[] = [makeCondition({ type: 'Ready', reason: 'MissingFolderMetadata' })];
    expect(hasMissingFolderMetadata(conditions)).toBe(false);
  });

  it('finds PullStatus among multiple conditions', () => {
    const conditions: Condition[] = [
      makeCondition({ type: 'Ready', reason: 'Available' }),
      makeCondition({ type: 'ResourceQuota', reason: 'WithinQuota' }),
      makeCondition({ type: 'PullStatus', reason: 'MissingFolderMetadata' }),
    ];
    expect(hasMissingFolderMetadata(conditions)).toBe(true);
  });
});
