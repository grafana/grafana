import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../../state/hooks';
import { findItem } from '../../state/utils';
import { DashboardTreeSelection } from '../../types';
import { getItemRepositoryUid } from '../utils';

type ItemKind = 'folder' | 'dashboard';

export function useRepositoryValidation(selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>) {
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector);
  const items = rootItems?.items || [];

  // Find repository for an item using the shared utility
  const findRepositoryUidForItem = (uid: string, kind: ItemKind): string | null => {
    const item = findItem(items, childrenByParentUID, uid);
    return item ? getItemRepositoryUid(item, items, childrenByParentUID) : null;
  };

  // Extract selected UIDs and create unified list with their types
  const getSelectedItems = () => {
    const folders = Object.entries(selectedItems?.folder)
      .filter(([, isSelected]) => isSelected)
      .map(([uid]) => ({ uid, kind: 'folder' as const }));

    const dashboards = Object.entries(selectedItems?.dashboard)
      .filter(([, isSelected]) => isSelected)
      .map(([uid]) => ({ uid, kind: 'dashboard' as const }));

    return [...folders, ...dashboards];
  };

  // Validate that all selected items belong to the same repository
  const validateRepositoryConsistency = (selectedItems: Array<{ uid: string; kind: ItemKind }>) => {
    if (selectedItems.length === 0) {
      return { allFromSameRepo: true, commonRepository: undefined };
    }

    const repositoryUIDs = selectedItems.map(({ uid, kind }) => findRepositoryUidForItem(uid, kind));
    const firstRepositoryUID = repositoryUIDs[0];
    const allFromSameRepo = repositoryUIDs.every((repo) => repo === firstRepositoryUID);

    return {
      allFromSameRepo,
      commonRepositoryUID: firstRepositoryUID || undefined,
    };
  };

  const allSelectedItems = getSelectedItems();
  const { allFromSameRepo, commonRepositoryUID } = validateRepositoryConsistency(allSelectedItems);

  return {
    allFromSameRepo,
    commonRepositoryUID,
    selectedCount: allSelectedItems.length,
    hasSelection: allSelectedItems.length > 0,
  };
}
