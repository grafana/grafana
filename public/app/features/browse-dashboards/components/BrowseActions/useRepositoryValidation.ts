import { ManagerKind } from 'app/features/apiserver/types';
import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../../state/hooks';
import { findItem } from '../../state/utils';
import { DashboardTreeSelection } from '../../types';

export function useRepositoryValidation(selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>) {
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector);

  // Get repository for any item (folder or dashboard)
  const getRepositoryForItem = (uid: string, kind: 'folder' | 'dashboard'): string | null => {
    const item = findItem(rootItems?.items || [], childrenByParentUID, uid);
    if (!item) {
      return null;
    }

    // If it's a root provisioned folder, the UID is the repository name
    if (item.managedBy === ManagerKind.Repo && !item.parentUID && kind === 'folder') {
      return uid;
    }

    // If it's a nested item, traverse up to find root provisioned folder
    if (item.parentUID) {
      let currentUID: string | undefined = item.parentUID;
      while (currentUID) {
        const parent = findItem(rootItems?.items || [], childrenByParentUID, currentUID);
        if (!parent) {
          break;
        }

        if (parent.managedBy === ManagerKind.Repo && !parent.parentUID) {
          return currentUID; // Found root provisioned folder
        }
        currentUID = parent.parentUID;
      }
    }

    return null; // Non-provisioned item
  };

  // Validate repository consistency
  const selectedFolderUids = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
  const selectedDashboardUids = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);

  let commonRepository: string | null = null;
  let allFromSameRepo = true;

  // Check all selected items
  const allSelectedItems = [
    ...selectedFolderUids.map((uid) => ({ uid, kind: 'folder' as const })),
    ...selectedDashboardUids.map((uid) => ({ uid, kind: 'dashboard' as const })),
  ];

  for (const { uid, kind } of allSelectedItems) {
    const itemRepo = getRepositoryForItem(uid, kind);

    if (commonRepository === null) {
      commonRepository = itemRepo;
    } else if (commonRepository !== itemRepo) {
      allFromSameRepo = false;
      break;
    }
  }

  return {
    allFromSameRepo,
    commonRepository: commonRepository || undefined,
    selectedCount: allSelectedItems.length,
    hasSelection: allSelectedItems.length > 0,
  };
}
