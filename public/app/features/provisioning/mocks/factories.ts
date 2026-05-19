import { type Job, type Repository } from 'app/api/clients/provisioning/v0alpha1';

const DEFAULT_REPOSITORY_NAME = 'test-repo-abc123';
const DEFAULT_REPOSITORY_LABEL = { 'provisioning.grafana.app/repository': DEFAULT_REPOSITORY_NAME };

export function createJob(overrides: Record<string, unknown> = {}): Job {
  const {
    metadata: metadataOverrides,
    spec: specOverrides,
    status: statusOverrides,
    ...rest
  } = overrides as Partial<Job>;

  return {
    ...rest,
    metadata: {
      name: 'job-1',
      uid: 'uid-1',
      ...metadataOverrides,
      labels: {
        ...DEFAULT_REPOSITORY_LABEL,
        ...metadataOverrides?.labels,
      },
    },
    spec: {
      action: 'pull' as const,
      ...specOverrides,
    },
    status: {
      state: 'working' as const,
      message: 'Pulling...',
      progress: 30,
      ...statusOverrides,
    },
  } as Job;
}

export function createRepository(overrides: Record<string, unknown> = {}): Repository {
  const {
    metadata: metadataOverrides,
    spec: specOverrides,
    status: statusOverrides,
    ...rest
  } = overrides as Partial<Repository>;

  return {
    ...rest,
    metadata: {
      name: DEFAULT_REPOSITORY_NAME,
      generation: 1,
      ...metadataOverrides,
    },
    spec: {
      title: 'Test Repository',
      type: 'github',
      sync: { target: 'folder', enabled: true },
      workflows: [],
      github: {
        url: 'https://github.com/test/repo',
        branch: 'main',
      },
      ...specOverrides,
    },
    status: {
      observedGeneration: 1,
      health: {
        healthy: true,
        checked: 1704067200000,
        message: [],
      },
      ...statusOverrides,
    },
  } as Repository;
}
