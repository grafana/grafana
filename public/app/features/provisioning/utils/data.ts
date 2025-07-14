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

  switch (data.type) {
    case 'github':
      spec.github = {
        generateDashboardPreviews: data.generateDashboardPreviews,
        url: data.url || '',
        branch: data.branch,
        token: data.token,
        path: data.path,
        encryptedToken: data.encryptedToken,
      };
      break;
    case 'gitlab':
      spec.gitlab = {
        url: data.url || '',
        branch: data.branch,
        token: data.token,
        path: data.path,
        encryptedToken: data.encryptedToken,
      };
      break;
    case 'bitbucket':
      spec.bitbucket = {
        url: data.url || '',
        branch: data.branch,
        token: data.token,
        path: data.path,
        encryptedToken: data.encryptedToken,
      };
      break;
    case 'git':
      spec.git = {
        url: data.url || '',
        branch: data.branch,
        token: data.token,
        path: data.path,
        encryptedToken: data.encryptedToken,
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
    // Spread the appropriate config based on type
    ...spec.github,
    ...spec.gitlab,
    ...spec.bitbucket,
    ...spec.git,
    ...spec.local,
    // Ensure common fields are always present
    branch: spec.github?.branch || spec.gitlab?.branch || spec.bitbucket?.branch || spec.git?.branch || '',
    url: spec.github?.url || spec.gitlab?.url || spec.bitbucket?.url || spec.git?.url || '',
    generateDashboardPreviews: spec.github?.generateDashboardPreviews || false,
    readOnly: !spec.workflows.length,
    prWorkflow: spec.workflows.includes('write'),
  });
};
