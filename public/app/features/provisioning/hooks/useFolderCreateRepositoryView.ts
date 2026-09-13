import { isRootFolderUID } from 'app/features/search/constants';
import { type FolderDTO } from 'app/types/folders';

import { isItemManagedByRepository } from '../utils/managedResource';

import { getFolderRepositoryArgs, RepoViewStatus, useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export interface FolderCreateRepositoryView {
  /** The choice of form has not settled; render a spinner rather than guessing one */
  isLoading: boolean;
  /** Creation here must go through a repository. Dead ends included: the provisioned form owns their alert */
  isProvisioned: boolean;
  /** Root of a folderless repository: the one place creation can legitimately go either way */
  canChooseTarget: boolean;
  /** The lookup failed with nothing resolved, so a repository may exist that could not be offered */
  isError: boolean;
  /** Only meaningful alongside isError */
  error?: unknown;
}

/**
 * Resolves where a folder created at this location is written. A repository-managed parent folder
 * settles it from its own manager annotation. The root has no parent to read, so the lookup falls
 * back to an instance or folderless repository. Folderless is the one case the user may override:
 * such a repository manages no folder by name, so at the root the Grafana database is an equally
 * valid target.
 *
 * This is the folder counterpart of useDashboardRepositoryView, and canChooseTarget is the same
 * rule SaveDashboardDrawer applies to a new dashboard, so the two surfaces cannot drift.
 */
export function useFolderCreateRepositoryView(parentFolder?: FolderDTO): FolderCreateRepositoryView {
  const isRoot = isRootFolderUID(parentFolder?.uid);
  const view = useGetResourceRepositoryView(getFolderRepositoryArgs(parentFolder?.uid));

  // The parent's own annotation settles a managed subfolder without waiting on the lookup, so a
  // slow or failed lookup can never route a repository-managed folder to the database form
  const isProvisioned = isItemManagedByRepository(parentFolder) || Boolean(view.repository);

  return {
    isProvisioned,
    isLoading: !isProvisioned && view.status === RepoViewStatus.Loading,
    canChooseTarget: isRoot && view.repository?.target === 'folderless',
    isError: !isProvisioned && view.status === RepoViewStatus.Error,
    error: view.error,
  };
}
