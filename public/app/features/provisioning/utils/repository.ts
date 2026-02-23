import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { findItem } from 'app/features/browse-dashboards/state/utils';
import { BrowseDashboardsState } from 'app/features/browse-dashboards/types';
import { DashboardViewItem } from 'app/features/search/types';

import { RepoWorkflows } from '../types';

export function getIsReadOnlyWorkflows(workflows?: RepoWorkflows): boolean {
  // Repository is considered read-only if it has no workflows defined (workflows are required for write operations)
  return workflows?.length === 0;
}

export function getIsReadOnlyRepo(repository: RepositoryView | undefined): boolean {
  if (!repository) {
    return false;
  }

  return getIsReadOnlyWorkflows(repository.workflows);
}

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
