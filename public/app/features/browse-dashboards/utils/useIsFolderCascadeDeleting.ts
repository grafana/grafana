import { skipToken } from '@reduxjs/toolkit/query';

import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

const POLL_INTERVAL_MS = 5000;

/**
 * Whether this folder itself currently has a deletionTimestamp set (its own async cascade delete
 * is in progress) -- used to disable actions that don't make sense on a folder that's being
 * removed (move it, create new content inside it, rename it, delete it again).
 */
export function useIsFolderCascadeDeleting(folderUID: string | undefined): boolean {
  const { data } = useGetFolderQuery(folderUID ? { name: folderUID } : skipToken, {
    pollingInterval: POLL_INTERVAL_MS,
  });
  return Boolean(data?.metadata?.deletionTimestamp);
}
