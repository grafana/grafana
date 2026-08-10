import { supportsPullRequests, supportsWebhooks } from './repositoryTypes';

describe('supportsWebhooks', () => {
  it.each(['github', 'githubEnterprise', 'gitlab', 'bitbucket'] as const)('should return true for %s', (type) => {
    expect(supportsWebhooks(type)).toBe(true);
  });

  it.each(['git', 'local'] as const)('should return false for %s', (type) => {
    expect(supportsWebhooks(type)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(supportsWebhooks(undefined)).toBe(false);
  });
});

describe('supportsPullRequests', () => {
  it.each(['github', 'githubEnterprise', 'gitlab', 'bitbucket'] as const)('should return true for %s', (type) => {
    expect(supportsPullRequests(type)).toBe(true);
  });

  it.each(['git', 'local'] as const)('should return false for %s', (type) => {
    expect(supportsPullRequests(type)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(supportsPullRequests(undefined)).toBe(false);
  });

  it('should match supportsWebhooks for every RepoType', () => {
    for (const type of ['github', 'githubEnterprise', 'gitlab', 'bitbucket', 'git', 'local'] as const) {
      expect(supportsPullRequests(type)).toBe(supportsWebhooks(type));
    }
    expect(supportsPullRequests(undefined)).toBe(supportsWebhooks(undefined));
  });
});
