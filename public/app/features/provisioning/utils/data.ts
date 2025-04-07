import { RepositorySpec } from 'app/api/clients/provisioning';

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
        path: data.path,
      };
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
  return structuredClone({
    ...spec,
    ...spec.github,
    ...spec.local,
    branch: spec.github?.branch || '',
    url: spec.github?.url || '',
    generateDashboardPreviews: spec.github?.generateDashboardPreviews || false,
  });
};
