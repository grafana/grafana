import { generatePath } from './path';

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
});
