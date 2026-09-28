import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect } from 'react';

import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { useDispatch } from 'app/types/store';

import { itemCascadeDeleteStarted } from '../state/slice';

/**
 * One-shot (no polling) check for whether a folder row -- not already known to be
 * cascade-deleting -- actually is. Covers the case where its delete was triggered somewhere this
 * browser session never observed (e.g. directly via the API for a demo, or by a different user or
 * tab): cascadeDeletingUIDs is purely session-local, populated only by the delete facades
 * themselves or by propagation from an already-watched ancestor (see
 * usePropagateCascadeDeleteToChildren), so a folder nobody in this session has triggered or
 * watched a delete on shows up as a perfectly ordinary row even mid-cascade.
 *
 * Once discovered, dispatches itemCascadeDeleteStarted so the existing DeletingFolderBadge (and
 * its own propagation to already-loaded children) takes over with full continuous polling; this
 * hook then skips its own query entirely. Deliberately scoped to folders, not dashboards: a
 * dashboard's cascade-deleting state is essentially always discovered this same way via its
 * *parent* folder's propagation once that folder is found, so there's no need to pay for this
 * check on every dashboard row too.
 */
export function useDiscoverCascadeDeleting(folderUID: string, alreadyTracked: boolean) {
  const dispatch = useDispatch();
  const { data } = useGetFolderQuery(alreadyTracked ? skipToken : { name: folderUID });

  useEffect(() => {
    if (data?.metadata?.deletionTimestamp) {
      dispatch(itemCascadeDeleteStarted(folderUID));
    }
  }, [data, dispatch, folderUID]);
}
