import { RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryFormData } from '../types';

import { dataToSpec, generateRepositoryTitle, specToData } from './data';

const baseSync = {
  enabled: true,
  target: 'folder' as const,
  intervalSeconds: 60,
};

function makeFormData(type: RepositoryFormData['type']): RepositoryFormData {
  return {
    type,
    title: 'repo',
    description: '',
    sync: baseSync,
    readOnly: false,
    prWorkflow: false,
    enablePushToConfiguredBranch: true,
    token: 'secret-token',
    tokenUser: 'test-user',
    url: 'https://example.com/repo.git',
    branch: 'main',
    path: '',
    connectionName: '',
    generateDashboardPreviews: false,
  };
}

describe('provisioning data mapping', () => {
  it('adds tokenUser to bitbucket spec', () => {
    const spec = dataToSpec(makeFormData('bitbucket'));

    expect(spec.bitbucket?.tokenUser).toBe('test-user');
  });

  it('reads tokenUser from bitbucket spec', () => {
    const spec: RepositorySpec = {
      type: 'bitbucket',
      title: 'repo',
      description: '',
      sync: baseSync,
      workflows: [],
      bitbucket: {
        url: 'https://bitbucket.org/owner/repo',
        branch: 'main',
        path: '',
        tokenUser: 'x-token-auth',
      },
    };

    const data = specToData(spec);
    expect(data.tokenUser).toBe('x-token-auth');
  });
});

describe('generateRepositoryTitle', () => {
  it.each([
    { type: 'github' as const, url: 'https://github.com/owner/repo', expected: 'owner/repo' },
    { type: 'gitlab' as const, url: 'https://gitlab.com/owner/repo', expected: 'owner/repo' },
    { type: 'bitbucket' as const, url: 'https://bitbucket.org/owner/repo', expected: 'owner/repo' },
    { type: 'git' as const, url: 'https://git.example.com/owner/repo.git', expected: 'owner/repo.git' },
  ])('strips SaaS domain from $type URL', ({ type, url, expected }) => {
    expect(generateRepositoryTitle({ type, url })).toBe(expected);
  });

  it.each([
    { type: 'github' as const, url: 'https://github.enterprise.com/org/repo', expected: 'org/repo' },
    { type: 'gitlab' as const, url: 'https://gitlab.self-hosted.com/org/repo', expected: 'org/repo' },
    { type: 'bitbucket' as const, url: 'https://bitbucket.self-hosted.com/org/repo', expected: 'org/repo' },
  ])('strips self-hosted domain from $type URL', ({ type, url, expected }) => {
    expect(generateRepositoryTitle({ type, url })).toBe(expected);
  });

  it('returns path for local type', () => {
    expect(generateRepositoryTitle({ type: 'local', path: '/path/to/repo' })).toBe('/path/to/repo');
  });
});
