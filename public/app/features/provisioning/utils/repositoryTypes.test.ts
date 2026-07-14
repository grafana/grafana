import { supportsWebhooks } from './repositoryTypes';

describe('supportsWebhooks', () => {
  it.each(['github', 'githubEnterprise', 'gitlab'] as const)('should return true for %s', (type) => {
    expect(supportsWebhooks(type)).toBe(true);
  });

  it.each(['bitbucket', 'git', 'local'] as const)('should return false for %s', (type) => {
    expect(supportsWebhooks(type)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(supportsWebhooks(undefined)).toBe(false);
  });
});
