import { RepositorySpec } from '../../../api/clients/provisioning';
import { RepositoryFormData } from '../types';
import { specToData } from '../utils/data';

export function getDefaultValues(repository?: RepositorySpec): RepositoryFormData {
  if (!repository) {
    return {
      type: 'github',
      title: 'Repository',
      token: '',
      url: '',
      branch: 'main',
      generateDashboardPreviews: false,
      readOnly: false,
      prWorkflow: true,
      path: 'grafana/',
      sync: {
        enabled: false,
        target: 'instance',
        intervalSeconds: 60,
      },
    };
  }
  return specToData(repository);
}
