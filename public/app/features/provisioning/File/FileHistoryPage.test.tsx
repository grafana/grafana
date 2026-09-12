import { getAuthorProfileUrl } from './FileHistoryPage';

describe('getAuthorProfileUrl', () => {
  it('derives the host from the repo URL for github', () => {
    expect(getAuthorProfileUrl('github', 'octocat', 'https://github.com/owner/repo')).toBe(
      'https://github.com/octocat'
    );
  });

  it('derives the host from the repo URL for githubEnterprise (GHES/GHE Cloud)', () => {
    expect(getAuthorProfileUrl('githubEnterprise', 'octocat', 'https://ghes.example.com/owner/repo')).toBe(
      'https://ghes.example.com/octocat'
    );
  });

  it('derives the host from the repo URL for gitlab', () => {
    expect(getAuthorProfileUrl('gitlab', 'user', 'https://gitlab.com/group/repo')).toBe('https://gitlab.com/user');
  });

  it('derives the host from the repo URL for bitbucket', () => {
    expect(getAuthorProfileUrl('bitbucket', 'user', 'https://bitbucket.org/owner/repo')).toBe(
      'https://bitbucket.org/user'
    );
  });

  it('uses the self-managed host for gitlab, not gitlab.com', () => {
    expect(getAuthorProfileUrl('gitlab', 'user', 'https://gitlab.internal.corp/group/repo')).toBe(
      'https://gitlab.internal.corp/user'
    );
  });

  it('uses the self-managed (Data Center) host for bitbucket, not bitbucket.org', () => {
    expect(getAuthorProfileUrl('bitbucket', 'user', 'https://bitbucket.internal.corp/scm/proj/repo')).toBe(
      'https://bitbucket.internal.corp/user'
    );
  });

  it('preserves a non-default port from the repo URL', () => {
    expect(getAuthorProfileUrl('githubEnterprise', 'octocat', 'https://ghes.example.com:8443/owner/repo')).toBe(
      'https://ghes.example.com:8443/octocat'
    );
  });

  it('drops the repo path and only keeps the host origin', () => {
    expect(getAuthorProfileUrl('github', 'octocat', 'https://github.com/owner/repo/deep/path.json')).toBe(
      'https://github.com/octocat'
    );
  });

  it('returns undefined for git type even with a repo URL', () => {
    expect(getAuthorProfileUrl('git', 'user', 'https://git.example.com/owner/repo.git')).toBeUndefined();
  });

  it('returns undefined for local type', () => {
    expect(getAuthorProfileUrl('local', 'user', 'https://example.com/owner/repo')).toBeUndefined();
  });

  it('returns undefined for undefined type', () => {
    expect(getAuthorProfileUrl(undefined, 'user', 'https://github.com/owner/repo')).toBeUndefined();
  });

  it('returns undefined when no repo URL is provided', () => {
    expect(getAuthorProfileUrl('github', 'user')).toBeUndefined();
  });

  it('returns undefined for an invalid repo URL', () => {
    expect(getAuthorProfileUrl('github', 'user', 'not-a-url')).toBeUndefined();
  });

  it('encodes special characters in username', () => {
    expect(getAuthorProfileUrl('github', 'user name&special', 'https://github.com/owner/repo')).toBe(
      'https://github.com/user%20name%26special'
    );
  });

  it('encodes slashes in username', () => {
    expect(getAuthorProfileUrl('gitlab', 'org/user', 'https://gitlab.com/group/repo')).toBe(
      'https://gitlab.com/org%2Fuser'
    );
  });
});
