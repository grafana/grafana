import { useEffect } from 'react';

import { isFetchError } from '@grafana/runtime';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { useDispatch, useSelector } from 'app/types/store';

import { PAGE_SIZE } from '../api/constants';
import { refetchChildren } from '../state/actions';
import { itemCascadeDeleteFinished } from '../state/slice';
import { usePropagateCascadeDeleteToChildren } from '../utils/usePropagateCascadeDeleteToChildren';

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
  const { data, error } = useGetFolderQuery(
    { name: folderUID },
    { pollingInterval: POLL_INTERVAL_MS, refetchOnMountOrArgChange: true }
  );

  const isGone = isFetchError(error) && error.status === 404;
  // A folder only gets tracked here once it's actually confirmed cascade-deleting (see
  // trackCascadeDeleteIfStarted) or because its parent's own cascade has already started and
  // propagated tracking down to it (see usePropagateCascadeDeleteToChildren) -- in the latter
  // case, the backend may not have reached this particular child yet (a folder recurses into its
  // own children before it can be removed, unlike a flat dashboard delete), so its *own* GET can
  // legitimately keep responding with no deletionTimestamp for a while. Treat it as deleting
  // optimistically the whole time it's tracked, and only stop once it's actually gone -- there's
  // no reliable "definitely not going to be deleted after all" signal to bail out on early here.
  const isStillDeleting = !isGone;
  const cascadeDelete = data?.status?.cascadeDelete;
  // If this folder's *own* reconcile hasn't reported an error, fall back to whatever its parent's
  // cascade delete blamed on it by name (see usePropagateCascadeDeleteToChildren) -- this folder
  // has no way to know it's the one stuck otherwise.
  const propagatedErrors = useSelector((state) => state.browseDashboards.cascadeDeleteErrors[folderUID]);
  const errors = cascadeDelete?.errors ?? propagatedErrors;

  usePropagateCascadeDeleteToChildren(folderUID, isStillDeleting, cascadeDelete?.errors);

  useEffect(() => {
    // Truly gone -- stop tracking it and refetch the parent's children so the row disappears.
    if (isGone) {
      dispatch(itemCascadeDeleteFinished(folderUID));
      dispatch(refetchChildren({ parentUID, pageSize: PAGE_SIZE }));
    }
  }, [isGone, dispatch, folderUID, parentUID]);

  if (!isStillDeleting) {
    return null;
  }

  return (
    <CascadeDeleteIndicator
      // `remaining` defaults to 0 in the API's zero-value struct, indistinguishable from a
      // genuinely-confirmed "nothing left" unless the controller has actually reconciled this
      // folder at least once (state only gets set once it has) -- otherwise this would flash a
      // misleading "(0 left)" for a child the cascade hasn't reached yet.
      remaining={cascadeDelete?.state === 'working' ? cascadeDelete.remaining : undefined}
      errors={errors}
    />
  );
}
