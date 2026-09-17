import { useEffect, useRef } from 'react';

import { isFetchError } from '@grafana/runtime';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

import { CascadeDeleteIndicator } from '../CascadeDeleteIndicator';

const POLL_INTERVAL_MS = 2000;

interface Props {
  /** UID (k8s name) of the folder undergoing cascade delete. */
  folderUID: string;
  /**
   * Called exactly once, when there's nothing left to wait on for this UID: either it's
   * confirmed gone ("success"), or its cascade delete has hit an unrecoverable-looking error and
   * is stuck retrying ("error", with whatever messages the controller reported) -- either way,
   * the caller shouldn't keep waiting on this one.
   */
  onSettled: (folderUID: string, outcome: 'success' | 'error', errors?: string[]) => void;
}

/**
 * Polls a single folder until its async cascade delete either finishes or gets stuck, rendering
 * the same indicator DeletingFolderBadge shows in the browse tree. Used by DeleteModal to keep
 * itself open -- showing progress -- for as long as a delete it just triggered is still running in
 * the background, rather than dismissing the instant the delete request was accepted.
 *
 * Deliberately doesn't touch cascadeDeletingUIDs/Redux: that state drives the tree's own row
 * badges independently, and this component's polling is purely local to whichever modal renders
 * it.
 */
export function CascadeDeleteWaiter({ folderUID, onSettled }: Props) {
  const { data, error } = useGetFolderQuery({ name: folderUID }, { pollingInterval: POLL_INTERVAL_MS });

  const isGone = isFetchError(error) && error.status === 404;
  const cascadeState = data?.status?.cascadeDelete?.state;
  const cascadeErrors = data?.status?.cascadeDelete?.errors;
  const isStillDeleting = Boolean(data?.metadata?.deletionTimestamp);

  const hasSettledRef = useRef(false);
  useEffect(() => {
    if (hasSettledRef.current) {
      return;
    }
    if (isGone || (data && !isStillDeleting)) {
      // Either truly gone, or it came back without a deletionTimestamp -- meaning this delete
      // never actually started an async cascade in the first place (flag off, or the folder was
      // already empty and got removed synchronously) and there's nothing to wait for.
      hasSettledRef.current = true;
      onSettled(folderUID, 'success');
    } else if (cascadeState === 'error') {
      hasSettledRef.current = true;
      onSettled(folderUID, 'error', cascadeErrors);
    }
  }, [isGone, data, isStillDeleting, cascadeState, cascadeErrors, folderUID, onSettled]);

  if (!isStillDeleting) {
    return null;
  }

  return <CascadeDeleteIndicator remaining={data?.status?.cascadeDelete?.remaining} errors={cascadeErrors} />;
}
