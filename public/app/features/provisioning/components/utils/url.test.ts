import { getBranchUrl } from './url';

describe('getBranchUrl', () => {
  const baseUrl = 'https://github.com/org/repo';

  it('returns GitHub tree URL', () => {
    expect(getBranchUrl(baseUrl, 'main', 'github')).toBe('https://github.com/org/repo/tree/main');
  });

  it('returns GitLab tree URL', () => {
    const gitlabUrl = 'https://gitlab.com/org/repo';
    expect(getBranchUrl(gitlabUrl, 'develop', 'gitlab')).toBe('https://gitlab.com/org/repo/-/tree/develop');
  });

  it('returns Bitbucket src URL', () => {
    const bbUrl = 'https://bitbucket.org/org/repo';
    expect(getBranchUrl(bbUrl, 'feature/x', 'bitbucket')).toBe('https://bitbucket.org/org/repo/src/feature/x');
  });

  it('returns base URL for generic git', () => {
    expect(getBranchUrl(baseUrl, 'main', 'git')).toBe('https://github.com/org/repo');
  });

  it('returns empty string for local repos', () => {
    expect(getBranchUrl(baseUrl, 'main', 'local')).toBe('');
  });

  it('returns empty string for unknown repo type', () => {
    expect(getBranchUrl(baseUrl, 'main', 'unknown')).toBe('');
  });

  it('returns empty string when repoType is undefined', () => {
    expect(getBranchUrl(baseUrl, 'main')).toBe('');
  });

  it('strips trailing .git from base URL', () => {
    expect(getBranchUrl('https://github.com/org/repo.git', 'main', 'github')).toBe(
      'https://github.com/org/repo/tree/main'
    );
  });

  it('strips trailing slash from base URL', () => {
    expect(getBranchUrl('https://github.com/org/repo/', 'main', 'github')).toBe(
      'https://github.com/org/repo/tree/main'
    );
  });

  it('preserves branch names with slashes', () => {
    expect(getBranchUrl(baseUrl, 'folder-rename/my-folder', 'github')).toBe(
      'https://github.com/org/repo/tree/folder-rename/my-folder'
    );
  });
});
