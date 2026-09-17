import { useEffect } from 'react';

import { isFetchError } from '@grafana/runtime';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { useDispatch, useSelector } from 'app/types/store';

import { PAGE_SIZE } from '../api/constants';
import { refetchChildren } from '../state/actions';
import { itemCascadeDeleteFinished, itemCascadeDeleteStarted } from '../state/slice';

import { CascadeDeleteIndicator } from './CascadeDeleteIndicator';

// `getFolder` (unlike `listFolder`) doesn't support `watch`, so live-watching a single folder's
// delete progress isn't practical without backend changes. Polling every few seconds is
// responsive enough for this PoC without hammering the apiserver.
const POLL_INTERVAL_MS = 3000;

interface Props {
  /** UID (k8s name) of the folder undergoing cascade delete. */
  folderUID: string;
  /** UID of the folder's parent, so its row can be refetched once cascade delete completes. */
  parentUID?: string;
}

/**
 * Only rendered for folders tracked in `cascadeDeletingUIDs` (see state/slice.ts), so ordinary
 * folder rows never pay for an extra request. See CascadeDeleteIndicator for the shared visual.
 */
export function DeletingFolderBadge({ folderUID, parentUID }: Props) {
  const dispatch = useDispatch();
  const { data, error } = useGetFolderQuery({ name: folderUID }, { pollingInterval: POLL_INTERVAL_MS });

  const isGone = isFetchError(error) && error.status === 404;
  const isStillDeleting = Boolean(data?.metadata?.deletionTimestamp);

  // If this folder's own children happen to already be loaded (the user has it expanded), mark
  // them as cascade-deleting too, purely for visual effect: the backend cascades this folder's
  // *own* direct children independently of whatever the frontend is watching, so there's no
  // per-child confirmation to wait for here -- this just lets DeletingFolderBadge/
  // DeletingDashboardBadge render on those rows too instead of them just sitting there unchanged
  // until the parent's own row disappears.
  const childItems = useSelector((state) => state.browseDashboards.childrenByParentUID[folderUID]?.items);
  useEffect(() => {
    if (!isStillDeleting || !childItems) {
      return;
    }
    for (const child of childItems) {
      dispatch(itemCascadeDeleteStarted(child.uid));
    }
  }, [isStillDeleting, childItems, dispatch]);

  useEffect(() => {
    // Either the folder is truly gone (404) or it came back without a deletionTimestamp
    // (shouldn't normally happen once cascade delete starts, but fail safe) -- either way,
    // stop tracking it and refetch the parent's children so the row updates/disappears.
    if (isGone || (data && !isStillDeleting)) {
      dispatch(itemCascadeDeleteFinished(folderUID));
      dispatch(refetchChildren({ parentUID, pageSize: PAGE_SIZE }));
    }
  }, [isGone, data, isStillDeleting, dispatch, folderUID, parentUID]);

  if (!isStillDeleting) {
    return null;
  }

  return (
    <CascadeDeleteIndicator
      remaining={data?.status?.cascadeDelete?.remaining}
      errors={data?.status?.cascadeDelete?.errors}
    />
  );
}
