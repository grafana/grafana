import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { getTargetFolderPathInRepo, getNestedFolderPath } from './utils';

const MOCK_FOLDER = {
  metadata: { annotations: { [AnnoKeySourcePath]: 'path/to/folder' } },
  spec: { title: 'folder title' },
  status: {},
};

describe('getTargetFolderPathInRepo', () => {
  it('should return root path for empty UID', () => {
    const result = getTargetFolderPathInRepo({ targetFolderUID: '' });
    expect(result).toBe('/');
  });

  it('should return empty string for empty UID and hide prepend slash', () => {
    const result = getTargetFolderPathInRepo({ targetFolderUID: '', hidePrependSlash: true });
    expect(result).toBe('');
  });

  it('should return root path for repository root folder', () => {
    const result = getTargetFolderPathInRepo({
      targetFolder: MOCK_FOLDER,
      repoName: 'my-repo',
      targetFolderUID: '',
    });
    expect(result).toBe('/');
  });

  it('should return nested folder path', () => {
    const result = getTargetFolderPathInRepo({
      targetFolder: MOCK_FOLDER,
      targetFolderUID: 'folder-uid',
    });
    expect(result).toBe('path/to/folder/');
  });

  it('should return undefined when invalid folder is provided', () => {
    const result = getTargetFolderPathInRepo({
      targetFolder: undefined,
      targetFolderUID: 'folder-uid',
    });
    expect(result).toBeUndefined();
  });
});

describe('getNestedFolderPath', () => {
  it('should return undefined for invalid folder', () => {
    const result = getNestedFolderPath(undefined);
    expect(result).toBeUndefined();
  });

  it('should return empty string for empty UID and hide prepend slash', () => {
    // @ts-expect-error
    const result = getNestedFolderPath({});
    expect(result).toBe('/');
  });
});
