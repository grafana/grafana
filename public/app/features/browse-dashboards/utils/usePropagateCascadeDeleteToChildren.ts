import { useEffect } from 'react';

import { useDispatch, useSelector } from 'app/types/store';

import { itemCascadeDeleteErrored, itemCascadeDeleteStarted } from '../state/slice';

/**
 * If this folder's own children happen to already be loaded (the user has it expanded, or is
 * standing inside it), marks them as cascade-deleting too, purely for visual effect: the backend
 * cascades this folder's *own* direct children independently of whatever the frontend is
 * watching, so there's no per-child confirmation to wait for here -- this just lets
 * DeletingFolderBadge/DeletingDashboardBadge render on those rows too (and keeps the list
 * refreshing as each child actually disappears), instead of them just sitting there unchanged
 * until the parent itself is gone. Shared by DeletingFolderBadge (watching the folder as a row
 * from its parent) and FolderCascadeStatusBanner (watching it from inside itself).
 *
 * A child folder or dashboard has no status of its own to report a stuck delete -- the error
 * lives on whichever ancestor's reconcile pass actually tried and failed to delete it (see
 * cascade_delete_controller.go's per-child error messages, which name the child by UID). If any
 * of this folder's own errors mention a specific child, that child is marked errored too (see
 * cascadeDeleteErrors), so its row can show the stuck badge instead of a plain spinner forever.
 */
export function usePropagateCascadeDeleteToChildren(folderUID: string, isDeleting: boolean, errors?: string[]) {
  const dispatch = useDispatch();
  const childItems = useSelector((state) => state.browseDashboards.childrenByParentUID[folderUID]?.items);

  useEffect(() => {
    if (!isDeleting || !childItems) {
      return;
    }
    for (const child of childItems) {
      dispatch(itemCascadeDeleteStarted(child.uid));
      const childErrors = errors?.filter((err) => err.includes(child.uid));
      if (childErrors && childErrors.length > 0) {
        dispatch(itemCascadeDeleteErrored({ uid: child.uid, errors: childErrors }));
      }
    }
  }, [isDeleting, childItems, errors, dispatch]);
}
