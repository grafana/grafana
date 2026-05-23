import { ensureFolderPathTrailingSlash, generatePath, joinPath, slugifyForFilename, splitPath } from './path';

describe('generatePath', () => {
  const timestamp = '2023-05-15-abcde';

  it('should generate path using slug when pathFromAnnotation is not provided', () => {
    const result = generatePath({
      timestamp,
      slug: 'my-dashboard',
    });

    expect(result).toBe('my-dashboard.json');
  });

  it('should use default slug with timestamp when neither pathFromAnnotation nor slug is provided', () => {
    const result = generatePath({
      timestamp,
    });

    expect(result).toBe('new-dashboard-2023-05-15-abcde.json');
  });

  it('should use pathFromAnnotation when provided', () => {
    const result = generatePath({
      timestamp,
      pathFromAnnotation: 'dashboards/my-custom-path.json',
      slug: 'my-dashboard', // This should be ignored when pathFromAnnotation is provided
    });

    expect(result).toBe('dashboards/my-custom-path.json');
  });

  it('should remove hash from pathFromAnnotation', () => {
    const result = generatePath({
      timestamp,
      pathFromAnnotation: 'dashboards/my-custom-path.json#some-hash',
    });

    expect(result).toBe('dashboards/my-custom-path.json');
  });

  it('should prepend folderPath when provided', () => {
    const result = generatePath({
      timestamp,
      slug: 'my-dashboard',
      folderPath: 'folder/path',
    });

    expect(result).toBe('folder/path/my-dashboard.json');
  });

  it('should use pathFromAnnotation when both are provided', () => {
    const result = generatePath({
      timestamp,
      pathFromAnnotation: 'full/path/my-custom-path.json', // this is always the full path
      folderPath: 'full/path', // this will be a substring
    });

    expect(result).toBe('full/path/my-custom-path.json');
  });

  it('should handle empty folderPath', () => {
    const result = generatePath({
      timestamp,
      slug: 'my-dashboard',
      folderPath: '',
    });

    expect(result).toBe('my-dashboard.json');
  });

  it('should normalize folderPath with trailing slash', () => {
    const result = generatePath({
      timestamp,
      slug: 'my-dashboard',
      folderPath: 'team-alpha/',
    });

    expect(result).toBe('team-alpha/my-dashboard.json');
  });
});

describe('splitPath', () => {
  it('should split a path with directory and filename', () => {
    expect(splitPath('dashboards/my-dash.json')).toEqual({ directory: 'dashboards', filename: 'my-dash.json' });
  });

  it('should handle nested directories', () => {
    expect(splitPath('a/b/c/file.json')).toEqual({ directory: 'a/b/c', filename: 'file.json' });
  });

  it('should handle filename only', () => {
    expect(splitPath('my-dash.json')).toEqual({ directory: '', filename: 'my-dash.json' });
  });

  it('should handle empty string', () => {
    expect(splitPath('')).toEqual({ directory: '', filename: '' });
  });

  it('should handle trailing slash', () => {
    expect(splitPath('dashboards/')).toEqual({ directory: 'dashboards', filename: '' });
  });
});

describe('joinPath', () => {
  it('should join directory and filename', () => {
    expect(joinPath('dashboards', 'my-dash.json')).toBe('dashboards/my-dash.json');
  });

  it('should handle empty directory', () => {
    expect(joinPath('', 'my-dash.json')).toBe('my-dash.json');
  });

  it('should strip trailing slashes from directory', () => {
    expect(joinPath('dashboards/', 'my-dash.json')).toBe('dashboards/my-dash.json');
  });

  it('should strip leading slashes from filename', () => {
    expect(joinPath('dashboards', '/my-dash.json')).toBe('dashboards/my-dash.json');
  });

  it('should handle both trailing and leading slashes', () => {
    expect(joinPath('dashboards/', '/my-dash.json')).toBe('dashboards/my-dash.json');
  });

  it('should handle empty filename', () => {
    expect(joinPath('dashboards', '')).toBe('dashboards/');
  });

  it('should handle both empty', () => {
    expect(joinPath('', '')).toBe('');
  });
});

describe('slugifyForFilename', () => {
  it('should convert a simple title to a slug', () => {
    expect(slugifyForFilename('My Cool Dashboard')).toBe('my-cool-dashboard');
  });

  it('should handle special characters', () => {
    expect(slugifyForFilename('CPU Usage (%) — Host')).toBe('cpu-usage-host');
  });

  it('should collapse multiple spaces into a single dash', () => {
    expect(slugifyForFilename('a    b')).toBe('a-b');
  });

  it('should strip leading and trailing dashes', () => {
    expect(slugifyForFilename('  hello  ')).toBe('hello');
  });

  it('should return empty string for title with only special characters', () => {
    expect(slugifyForFilename('!!!')).toBe('');
  });

  it('should return empty string for empty title', () => {
    expect(slugifyForFilename('')).toBe('');
  });

  it('should handle underscores (kept as word characters)', () => {
    expect(slugifyForFilename('my_dashboard')).toBe('my_dashboard');
  });

  it('should handle numeric titles', () => {
    expect(slugifyForFilename('123 Test')).toBe('123-test');
  });
});

describe('ensureFolderPathTrailingSlash', () => {
  it('should append slash to path without trailing slash', () => {
    expect(ensureFolderPathTrailingSlash('folders/test-folder')).toBe('folders/test-folder/');
  });

  it('should not double-append slash to path already ending with slash', () => {
    expect(ensureFolderPathTrailingSlash('folders/test-folder/')).toBe('folders/test-folder/');
  });

  it('should return empty string unchanged', () => {
    expect(ensureFolderPathTrailingSlash('')).toBe('');
  });

  it('should handle single segment path', () => {
    expect(ensureFolderPathTrailingSlash('my-folder')).toBe('my-folder/');
  });

  it('should handle deeply nested path', () => {
    expect(ensureFolderPathTrailingSlash('a/b/c/d')).toBe('a/b/c/d/');
  });
});

it('should return empty string for undefined input', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(ensureFolderPathTrailingSlash(undefined as any)).toBe('');
});
