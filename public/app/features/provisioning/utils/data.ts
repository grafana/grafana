import { RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryFormData } from '../types';

const getWorkflows = (data: RepositoryFormData): RepositorySpec['workflows'] => {
  if (data.readOnly) {
    return [];
  }
  const workflows: RepositorySpec['workflows'] = ['write'];

  if (!data.prWorkflow) {
    return workflows;
  }

  return [...workflows, 'branch'];
};

export const dataToSpec = (data: RepositoryFormData): RepositorySpec => {
  const spec: RepositorySpec = {
    type: data.type,
    sync: data.sync,
    title: data.title || '',
    workflows: getWorkflows(data),
  };

  const baseConfig = {
    url: data.url || '',
    branch: data.branch,
    path: data.path,
  };

  switch (data.type) {
    case 'github':
      spec.github = {
        ...baseConfig,
        generateDashboardPreviews: data.generateDashboardPreviews,
      };
      break;
    case 'gitlab':
      spec.gitlab = baseConfig;
      break;
    case 'bitbucket':
      spec.bitbucket = baseConfig;
      break;
    case 'git':
      spec.git = baseConfig;
      break;
    case 'local':
      spec.local = {
        path: data.path,
      };
      spec.workflows = spec.workflows.filter((v) => v !== 'branch'); // branch only supported by github
      break;
  }

  // We need to deep clone the data, so it doesn't become immutable
  return structuredClone(spec);
};

export const specToData = (spec: RepositorySpec): RepositoryFormData => {
  const remoteConfig = spec.github || spec.gitlab || spec.bitbucket || spec.git;

  return structuredClone({
    ...spec,
    ...remoteConfig,
    ...spec.local,
    branch: remoteConfig?.branch || '',
    url: remoteConfig?.url || '',
    generateDashboardPreviews: spec.github?.generateDashboardPreviews || false,
    readOnly: !spec.workflows.length,
    prWorkflow: spec.workflows.includes('branch'),
  });
};

export const generateRepositoryTitle = (repository: Pick<RepositoryFormData, 'type' | 'url' | 'path'>): string => {
  switch (repository.type) {
    case 'github':
      const name = repository.url ?? 'github';
      return name.replace('https://github.com/', '');
    case 'gitlab':
      const gitlabName = repository.url ?? 'gitlab';
      return gitlabName.replace('https://gitlab.com/', '');
    case 'bitbucket':
      const bitbucketName = repository.url ?? 'bitbucket';
      return bitbucketName.replace('https://bitbucket.org/', '');
    case 'git':
      const gitName = repository.url ?? 'git';
      return gitName.replace(/^https?:\/\/[^\/]+\//, '');
    case 'local':
      return repository.path ?? 'local';
    default:
      return '';
  }
};
