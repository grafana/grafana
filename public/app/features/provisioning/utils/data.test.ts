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
  describe('bitbucket', () => {
    it('adds tokenUser to bitbucket spec', () => {
      const spec = dataToSpec(makeFormData('bitbucket'));

      expect(spec.bitbucket?.tokenUser).toBe('test-user');
      expect(spec.bitbucket?.url).toBe('https://example.com/repo.git');
      expect(spec.bitbucket?.branch).toBe('main');
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

  describe('pure git', () => {
    it('adds tokenUser to git spec', () => {
      const spec = dataToSpec(makeFormData('git'));

      expect(spec.git?.tokenUser).toBe('test-user');
      expect(spec.git?.url).toBe('https://example.com/repo.git');
      expect(spec.git?.branch).toBe('main');
    });

    it('reads git spec to form data', () => {
      const spec: RepositorySpec = {
        type: 'git',
        title: 'repo',
        description: '',
        sync: baseSync,
        workflows: [],
        git: {
          url: 'https://git.example.com/owner/repo.git',
          branch: 'main',
          path: 'grafana/',
          tokenUser: 'git-user',
        },
      };

      const data = specToData(spec);
      expect(data.type).toBe('git');
      expect(data.url).toBe('https://git.example.com/owner/repo.git');
      expect(data.branch).toBe('main');
      expect(data.path).toBe('grafana/');
    });
  });

  describe('gitlab', () => {
    it('maps form data to gitlab spec without tokenUser', () => {
      const spec = dataToSpec(makeFormData('gitlab'));

      expect(spec.gitlab?.url).toBe('https://example.com/repo.git');
      expect(spec.gitlab?.branch).toBe('main');
      expect(spec.gitlab?.path).toBe('');
      expect(spec.gitlab).not.toHaveProperty('tokenUser');
    });

    it('reads gitlab spec to form data', () => {
      const spec: RepositorySpec = {
        type: 'gitlab',
        title: 'repo',
        description: '',
        sync: baseSync,
        workflows: [],
        gitlab: {
          url: 'https://gitlab.com/owner/repo',
          branch: 'main',
          path: '',
        },
      };

      const data = specToData(spec);
      expect(data.type).toBe('gitlab');
      expect(data.url).toBe('https://gitlab.com/owner/repo');
      expect(data.branch).toBe('main');
    });
  });

  describe('github', () => {
    it('maps form data to github spec with generateDashboardPreviews', () => {
      const formData = makeFormData('github');
      formData.generateDashboardPreviews = true;
      const spec = dataToSpec(formData);

      expect(spec.github?.url).toBe('https://example.com/repo.git');
      expect(spec.github?.generateDashboardPreviews).toBe(true);
    });

    it('adds connection when connectionName is provided', () => {
      const formData = makeFormData('github');
      formData.connectionName = 'my-github-app';
      const spec = dataToSpec(formData, 'param-connection');

      expect(spec.connection?.name).toBe('my-github-app');
    });

    it('uses connectionName from parameter when not in form data', () => {
      const spec = dataToSpec(makeFormData('github'), 'param-connection');

      expect(spec.connection?.name).toBe('param-connection');
    });

    it('reads github spec to form data', () => {
      const spec: RepositorySpec = {
        type: 'github',
        title: 'repo',
        description: '',
        sync: baseSync,
        workflows: [],
        github: {
          url: 'https://github.com/owner/repo',
          branch: 'main',
          path: '',
          generateDashboardPreviews: true,
        },
      };

      const data = specToData(spec);
      expect(data.type).toBe('github');
      expect(data.url).toBe('https://github.com/owner/repo');
      expect(data.generateDashboardPreviews).toBe(true);
    });
  });

  describe('local', () => {
    it('maps form data to local spec and filters branch from workflows', () => {
      const formData = makeFormData('local');
      formData.path = '/var/lib/grafana/repos/my-repo';
      formData.prWorkflow = true;
      const spec = dataToSpec(formData);

      expect(spec.local?.path).toBe('/var/lib/grafana/repos/my-repo');
      expect(spec.workflows).not.toContain('branch');
    });

    it('reads local spec to form data', () => {
      const spec: RepositorySpec = {
        type: 'local',
        title: 'repo',
        description: '',
        sync: baseSync,
        workflows: [],
        local: {
          path: '/path/to/repo',
        },
      };

      const data = specToData(spec);
      expect(data.type).toBe('local');
      expect(data.path).toBe('/path/to/repo');
    });
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
