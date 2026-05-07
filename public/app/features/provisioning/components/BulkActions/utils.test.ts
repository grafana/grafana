import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import {
  getTargetFolderPathInRepo,
  getNestedFolderPath,
  getResourceTargetPath,
  isResourceAlreadyInTarget,
} from './utils';

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

  it('should not produce double slashes when sourcePath has trailing slash', () => {
    const result = getNestedFolderPath({
      metadata: { annotations: { [AnnoKeySourcePath]: 'path/to/folder/' } },
      spec: { title: 'folder title' },
    });
    expect(result).toBe('path/to/folder/');
  });

  it('should normalize path without trailing slash', () => {
    const result = getNestedFolderPath({
      metadata: { annotations: { [AnnoKeySourcePath]: 'path/to/folder' } },
      spec: { title: 'folder title' },
    });
    expect(result).toBe('path/to/folder/');
  });
});

describe('getResourceTargetPath', () => {
  it('should not produce double slashes when targetFolderPath has trailing slash', () => {
    const result = getResourceTargetPath('old/path/dashboard.json', 'new/path/');
    expect(result).toBe('new/path/dashboard.json');
  });

  it('should handle folder paths', () => {
    const result = getResourceTargetPath('old/path/folder/', 'new/path/');
    expect(result).toBe('new/path/folder/');
  });

  it('should handle targetFolderPath without trailing slash', () => {
    const result = getResourceTargetPath('old/path/dashboard.json', 'new/path');
    expect(result).toBe('new/path/dashboard.json');
  });

  it('should throw for invalid path', () => {
    expect(() => getResourceTargetPath('/', 'new/path')).toThrow('Invalid path');
  });
});

describe('isResourceAlreadyInTarget', () => {
  it('returns true when the computed target path matches the current resource path', () => {
    expect(isResourceAlreadyInTarget('test/dashboard.json', 'test/')).toBe(true);
  });

  it('returns false when the resource would move to a different path', () => {
    expect(isResourceAlreadyInTarget('test/dashboard.json', 'test2/')).toBe(false);
  });
});
