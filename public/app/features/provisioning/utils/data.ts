import { RepositorySpec } from '../../../api/clients/provisioning';
import { RepositoryFormData } from '../types';

export const dataToSpec = (data: RepositoryFormData): RepositorySpec => {
  const spec: RepositorySpec = {
    type: data.type,
    sync: data.sync,
    title: data.title || '',
    workflows: data.workflows,
  };
  switch (data.type) {
    case 'github':
      spec.github = {
        generateDashboardPreviews: data.generateDashboardPreviews,
        url: data.url || '',
        branch: data.branch,
        token: data.token,
      };
      break;
    case 'local':
      spec.local = {
        path: data.path,
      };
      break;
  }

  return spec;
};

export const specToData = (spec: RepositorySpec): RepositoryFormData => {
  return {
    ...spec,
    ...spec.github,
    ...spec.local,
    branch: spec.github?.branch || '',
    url: spec.github?.url || '',
  };
};
