import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { CORE_KINDS } from 'app/core/kinds/coreKinds';
import { ancestorsOf } from 'app/features/browse-dashboards/state/utils';
import { type BrowseDashboardsState } from 'app/features/browse-dashboards/types';
import { type DashboardViewItem } from 'app/features/search/types';

import { type RepoWorkflows } from '../types';

import { isItemManagedByRepository } from './managedResource';

export function getRepositoryResourcesUrl(name: string, resource: string): string {
  return `${CORE_KINDS.repository.getRoute(name)}?tab=resources&resource=${resource}`;
}

export function getRepositoryOverviewUrl(name: string): string {
  return `${CORE_KINDS.repository.getRoute(name)}/?tab=overview`;
}

export function getRepositoryEditUrl(name: string): string {
  return `${CORE_KINDS.repository.getRoute(name)}/edit`;
}

export function getFileStatusUrl(repositoryName: string, path: string, ref?: string): string {
  const url = `${CORE_KINDS.repository.getRoute(repositoryName)}/file/${path}`;
  return ref === undefined ? url : `${url}?${new URLSearchParams({ ref }).toString()}`;
}

export function getFileHistoryUrl(repositoryName: string, path: string): string {
  return `${CORE_KINDS.repository.getRoute(repositoryName)}/history/${path}`;
}

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
