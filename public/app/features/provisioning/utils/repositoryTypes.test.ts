import { getOrderedRepositoryConfigs, getRepositoryTypeConfig, supportsWebhooks } from './repositoryTypes';

describe('supportsWebhooks', () => {
  it.each(['github', 'githubEnterprise', 'gitlab', 'bitbucket'] as const)('should return true for %s', (type) => {
    expect(supportsWebhooks(type)).toBe(true);
  });

  it.each(['git', 'local', 'source'] as const)('should return false for %s', (type) => {
    expect(supportsWebhooks(type)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(supportsWebhooks(undefined)).toBe(false);
  });
});

describe('source repository type', () => {
  it('is labelled and iconed without a logo asset', () => {
    const config = getRepositoryTypeConfig('source');

    expect(config).toMatchObject({ type: 'source', label: 'Source API', icon: 'cloud-download' });
    expect(config?.logo).toBeUndefined();
  });

  it('is listed with the providers that are not git providers', () => {
    const { gitProviders, otherProviders } = getOrderedRepositoryConfigs(['github', 'local', 'source']);

    expect(gitProviders.map((config) => config.type)).toEqual(['github']);
    expect(otherProviders.map((config) => config.type)).toEqual(['local', 'source']);
  });
});
