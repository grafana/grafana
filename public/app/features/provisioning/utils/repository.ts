import { t } from '@grafana/i18n';
import { RepositoryView, RepoWorkflows } from 'app/api/clients/provisioning/v0alpha1';

export function getIsReadOnlyWorkflows(workflows?: RepoWorkflows): boolean {
  // Repository is consider read-only if it has no workflows defined (workflows are required for write operations)
  return workflows?.length === 0;
}

export function getIsReadOnlyRepo(repository: RepositoryView | undefined): boolean {
  if (!repository) {
    return false;
  }

  return getIsReadOnlyWorkflows(repository.workflows);
}

// Right now we only support local file provisioning message and git provisioned. This can be extend in the future as needed.
export const getReadOnlyTooltipText = ({ isLocal = false }) => {
  return isLocal
    ? t(
        'provisioning.read-only-local-tooltip',
        'This folder is read-only and provisioned through file provisioning. To make any changes in the folder, update the connected file repository. To modify the folder settings go to Administration > Provisioning > Repositories.'
      )
    : t(
        'provisioning.read-only-remote-tooltip',
        'This folder is read-only and provisioned through Git. To make any changes in the folder, update the connected repository. To modify the folder settings go to Administration > Provisioning > Repositories.'
      );
};
