import { t } from '@grafana/i18n';

import { RepositorySpec, RepositoryViewList } from '../../../api/clients/provisioning/v0alpha1';
import { RepositoryFormData } from '../types';
import { specToData } from '../utils/data';

export interface GetDefaultValuesOptions {
  repository?: RepositorySpec;
  allowedTargets?: RepositoryViewList['allowedTargets'];
}

export function getDefaultValues({
  repository,
  allowedTargets = ['instance', 'folder'],
}: GetDefaultValuesOptions = {}): RepositoryFormData {
  if (!repository) {
    const defaultTarget = allowedTargets.includes('folder') ? 'folder' : 'instance';

    return {
      type: 'github',
      title: t('provisioning.get-default-values.title.repository', 'Repository'),
      token: '',
      url: '',
      branch: 'main',
      generateDashboardPreviews: false,
      readOnly: false,
      prWorkflow: true,
      path: 'grafana/',
      sync: {
        enabled: false,
        target: defaultTarget,
        intervalSeconds: 60,
      },
    };
  }
  return specToData(repository);
}
