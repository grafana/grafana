import { type Condition } from 'app/api/clients/provisioning/v0alpha1';

import { getFolderMetadataPath, hasMissingFolderMetadata } from './folderMetadata';

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
