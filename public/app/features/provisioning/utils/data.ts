import { RepositorySpec } from '../api';
import { RepositoryFormData } from '../types';

export const dataToSpec = (data: RepositoryFormData): RepositorySpec => {
  const spec: RepositorySpec = {
    type: data.type,
    sync: data.sync,
    title: data.title || '',
    readOnly: data.readOnly,
  };
  switch (data.type) {
    case 'github':
      spec.github = {
        workflows: data.workflows,
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
    url: spec.github?.url || '',
  };
};
