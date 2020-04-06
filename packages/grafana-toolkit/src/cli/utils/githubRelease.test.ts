import { GitHubRelease } from './githubRelease';

describe('GithubRelease', () => {
  it('should initialise a GithubRelease', () => {
    const github = new GitHubRelease('A token', 'A username', 'A repo', 'Some release notes');
    expect(github).toBeInstanceOf(GitHubRelease);
  });
});
