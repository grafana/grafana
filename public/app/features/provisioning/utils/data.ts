import { RepositorySpec } from '../api/types';
import { RepositoryFormData } from '../types';

export const dataToSpec = (data: RepositoryFormData): RepositorySpec => {
  const spec: RepositorySpec = {
    type: data.type,
    folder: data.folder,
  };
  switch (data.type) {
    case 'github':
      spec.github = {
        branchWorkflow: data.branchWorkflow,
        generateDashboardPreviews: data.generateDashboardPreviews,
        owner: data.owner,
        repository: data.repository,
      };
      break;
    case 'local':
      spec.local = {
        path: data.path,
      };
      break;
    case 's3':
      spec.s3 = {
        bucket: data.bucket,
        region: data.region,
      };
      break;
  }

  return spec;
};
