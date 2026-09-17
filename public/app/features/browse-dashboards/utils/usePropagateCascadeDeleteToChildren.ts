import { useEffect } from 'react';

import { useDispatch, useSelector } from 'app/types/store';

import { itemCascadeDeleteStarted } from '../state/slice';

/**
 * If this folder's own children happen to already be loaded (the user has it expanded, or is
 * standing inside it), marks them as cascade-deleting too, purely for visual effect: the backend
 * cascades this folder's *own* direct children independently of whatever the frontend is
 * watching, so there's no per-child confirmation to wait for here -- this just lets
 * DeletingFolderBadge/DeletingDashboardBadge render on those rows too (and keeps the list
 * refreshing as each child actually disappears), instead of them just sitting there unchanged
 * until the parent itself is gone. Shared by DeletingFolderBadge (watching the folder as a row
 * from its parent) and FolderCascadeStatusBanner (watching it from inside itself).
 */
export function usePropagateCascadeDeleteToChildren(folderUID: string, isDeleting: boolean) {
  const dispatch = useDispatch();
  const childItems = useSelector((state) => state.browseDashboards.childrenByParentUID[folderUID]?.items);

  useEffect(() => {
    if (!isDeleting || !childItems) {
      return;
    }
    for (const child of childItems) {
      dispatch(itemCascadeDeleteStarted(child.uid));
    }
  }, [isDeleting, childItems, dispatch]);
}
