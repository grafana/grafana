import { skipToken } from '@reduxjs/toolkit/query';

import { useGetFolderParentsQuery } from 'app/api/clients/folder/v1beta1';

/**
 * Resolves a folder UID to its complete display path (root first, ending with the folder itself -
 * `GetFolderParents` already returns items in that order). RTK Query caches by the `{ name }` arg,
 * so multiple rows resolving the same folder UID share one request.
 *
 * A lookup failure (unreadable/deleted folder) must not disable the row it belongs to - callers
 * fall back to the raw UID.
 */
export function useFolderPath(folderUid: string | undefined) {
  const { data, isLoading, isError } = useGetFolderParentsQuery(folderUid ? { name: folderUid } : skipToken);

  if (!folderUid) {
    return { path: undefined, isLoading: false, isError: false };
  }

  if (isError || !data) {
    return { path: isLoading ? undefined : folderUid, isLoading, isError };
  }

  const path = data.items.map((item) => item.title).join(' / ');
  return { path: path || folderUid, isLoading: false, isError: false };
}
