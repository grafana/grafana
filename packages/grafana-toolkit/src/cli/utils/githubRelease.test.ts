import { GitHubRelease } from './githubRelease';

describe('GithubRelease', () => {
  it('should initialise a GithubRelease', () => {
    process.env.GITHUB_ACCESS_TOKEN = '12345';
    process.env.GITHUB_USERNAME = 'test@grafana.com';
    const github = new GitHubRelease('A token', 'A username', 'A repo', 'Some release notes');
    expect(github).toBeInstanceOf(GitHubRelease);
  });
});
