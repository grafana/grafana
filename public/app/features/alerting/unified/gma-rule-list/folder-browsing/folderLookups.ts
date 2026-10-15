import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback } from 'react';

import {
  type FolderInfo,
  generatedAPI as folderAPI,
  useGetFolderCountsQuery,
  useGetFolderParentsQuery,
} from '@grafana/api-clients/rtkq/folder/v1beta1';
import { getParsedCounts } from 'app/api/clients/folder/v1beta1/utils';
import { useDispatch } from 'app/types/store';

export function useFolderPath(folderUid: string | undefined): string[] | undefined {
  const { data } = useGetFolderParentsQuery(folderUid ? { name: folderUid } : skipToken);
  return data?.items.map((folder: FolderInfo) => folder.title);
}

/** A folder's count for one rule kind; `error` means the `/counts` lookup failed, not that it is pending. */
export type FolderRuleCount =
  | { status: 'loading' }
  | { status: 'loaded'; count: number }
  | { status: 'error'; retry: () => void };

export function useFolderAlertRuleCount(folderUid: string | undefined): FolderRuleCount {
  return useFolderRuleCount(folderUid, 'alertrules');
}

export function useFolderRecordingRuleCount(folderUid: string | undefined): FolderRuleCount {
  return useFolderRuleCount(folderUid, 'recordingrules');
}

/** The folder API is a separate RTK Query API, so the rule mutations' invalidation does not reach it. */
export function useInvalidateFolderData() {
  const dispatch = useDispatch();
  return useCallback(() => {
    dispatch(folderAPI.util.invalidateTags(['Folder']));
  }, [dispatch]);
}

function useFolderRuleCount(folderUid: string | undefined, resource: 'alertrules' | 'recordingrules'): FolderRuleCount {
  // Counts change when a rule is created or duplicated in the editor, outside these queries.
  const { data, isError, refetch } = useGetFolderCountsQuery(folderUid ? { name: folderUid } : skipToken, {
    refetchOnMountOrArgChange: true,
  });
  // A failed refetch keeps the last good count, so the row only reports an error when it has nothing to show.
  if (data) {
    // The response omits resources the folder holds none of.
    return { status: 'loaded', count: getParsedCounts(data.counts)[resource] ?? 0 };
  }
  return isError ? { status: 'error', retry: refetch } : { status: 'loading' };
}
