import { buildResourceBranchRedirectUrl } from './redirect';

describe('buildResourceBranchRedirectUrl', () => {
  it('returns the base URL with no params when nothing is provided', () => {
    expect(buildResourceBranchRedirectUrl({ baseUrl: '/playlists' })).toBe('/playlists');
  });

  it('defaults the base URL to /dashboards', () => {
    expect(buildResourceBranchRedirectUrl({})).toBe('/dashboards');
  });

  it('only sets the named param when both name and value are present', () => {
    expect(buildResourceBranchRedirectUrl({ baseUrl: '/playlists', paramName: 'new_pull_request_url' })).toBe(
      '/playlists'
    );
    expect(buildResourceBranchRedirectUrl({ baseUrl: '/playlists', paramValue: 'https://x' })).toBe('/playlists');
  });

  it('builds the full set of params (PR link, repo type, action and branch info)', () => {
    const url = buildResourceBranchRedirectUrl({
      baseUrl: '/playlists',
      paramName: 'new_pull_request_url',
      paramValue: 'https://github.com/org/repo/pull/1',
      repoType: 'github',
      action: 'create',
      ref: 'feature-branch',
      configuredBranch: 'main',
      repoUrl: 'https://github.com/org/repo',
    });

    const params = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/playlists?')).toBe(true);
    expect(params.get('new_pull_request_url')).toBe('https://github.com/org/repo/pull/1');
    expect(params.get('repo_type')).toBe('github');
    expect(params.get('action')).toBe('create');
    expect(params.get('ref')).toBe('feature-branch');
    expect(params.get('repo_branch')).toBe('main');
    expect(params.get('repo_url')).toBe('https://github.com/org/repo');
  });

  it('omits the branch params when not provided', () => {
    const url = buildResourceBranchRedirectUrl({
      baseUrl: '/playlists',
      paramName: 'new_pull_request_url',
      paramValue: 'https://x',
      action: 'delete',
    });

    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.has('ref')).toBe(false);
    expect(params.has('repo_branch')).toBe(false);
    expect(params.has('repo_url')).toBe(false);
    expect(params.get('action')).toBe('delete');
  });
});
