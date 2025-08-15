import { t } from '@grafana/i18n';
import { RepositoryView, RepoWorkflows } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { findItem } from 'app/features/browse-dashboards/state/utils';
import { BrowseDashboardsState } from 'app/features/browse-dashboards/types';
import { DashboardViewItem } from 'app/features/search/types';

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

/**
 * Finds the repository name for an item by traversing up the tree to find the root provisioned folder (managed by ManagerKind.Repo)
 * This should be an edge case where user have multiple provisioned folders and try to managing resources on root folder
 */
export function getItemRepositoryUid(
  item: DashboardViewItem,
  rootItems: DashboardViewItem[],
  childrenByParentUID: BrowseDashboardsState['childrenByParentUID']
): string {
  // For root provisioned folders, the UID is the repository name
  if (item.managedBy === ManagerKind.Repo && !item.parentUID && item.kind === 'folder') {
    return item.uid;
  }

  // Traverse up the tree to find the root provisioned folder
  let currentItem = item;
  while (currentItem.parentUID) {
    const parent = findItem(rootItems, childrenByParentUID, currentItem.parentUID);
    if (!parent) {
      break;
    }

    if (parent.managedBy === ManagerKind.Repo && !parent.parentUID) {
      return currentItem.parentUID;
    }

    currentItem = parent;
  }

  return 'non_provisioned';
}
