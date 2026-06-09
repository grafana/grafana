import { getAuthorProfileUrl } from './FileHistoryPage';

describe('getAuthorProfileUrl', () => {
  it('returns GitHub URL for github type', () => {
    expect(getAuthorProfileUrl('github', 'octocat')).toBe('https://github.com/octocat');
  });

  it('returns GitHub URL for githubEnterprise type', () => {
    expect(getAuthorProfileUrl('githubEnterprise', 'octocat')).toBe('https://github.com/octocat');
  });

  it('returns GitLab URL for gitlab type', () => {
    expect(getAuthorProfileUrl('gitlab', 'user')).toBe('https://gitlab.com/user');
  });

  it('returns Bitbucket URL for bitbucket type', () => {
    expect(getAuthorProfileUrl('bitbucket', 'user')).toBe('https://bitbucket.org/user');
  });

  it('returns undefined for git type', () => {
    expect(getAuthorProfileUrl('git', 'user')).toBeUndefined();
  });

  it('returns undefined for local type', () => {
    expect(getAuthorProfileUrl('local', 'user')).toBeUndefined();
  });

  it('returns undefined for undefined type', () => {
    expect(getAuthorProfileUrl(undefined, 'user')).toBeUndefined();
  });

  it('encodes special characters in username', () => {
    expect(getAuthorProfileUrl('github', 'user name&special')).toBe('https://github.com/user%20name%26special');
  });

  it('encodes slashes in username', () => {
    expect(getAuthorProfileUrl('gitlab', 'org/user')).toBe('https://gitlab.com/org%2Fuser');
  });
});
