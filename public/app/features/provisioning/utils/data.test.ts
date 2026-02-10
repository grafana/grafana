import { RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryFormData } from '../types';

import { dataToSpec, specToData } from './data';

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

  it('adds tokenUser to git spec', () => {
    const spec = dataToSpec(makeFormData('git'));

    expect(spec.git?.tokenUser).toBe('test-user');
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

  it('reads tokenUser from git spec', () => {
    const spec: RepositorySpec = {
      type: 'git',
      title: 'repo',
      description: '',
      sync: baseSync,
      workflows: [],
      git: {
        url: 'https://git.example.com/owner/repo.git',
        branch: 'main',
        path: '',
        tokenUser: 'git-user',
      },
    };

    const data = specToData(spec);
    expect(data.tokenUser).toBe('git-user');
  });
});
