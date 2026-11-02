import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { ancestorsOf } from 'app/features/browse-dashboards/state/utils';
import { type BrowseDashboardsState } from 'app/features/browse-dashboards/types';
import { type DashboardViewItem } from 'app/features/search/types';

import { type RepoWorkflows } from '../types';

import { isItemManagedByRepository } from './managedResource';

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
  if (isItemManagedByRepository(item) && !item.parentUID && item.kind === 'folder') {
    return item.uid;
  }

  for (const ancestor of ancestorsOf(item, rootItems, childrenByParentUID)) {
    if (isItemManagedByRepository(ancestor) && !ancestor.parentUID) {
      return ancestor.uid;
    }
  }

  return 'non_provisioned';
}
