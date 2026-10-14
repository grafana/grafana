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

/** Root-to-folder titles from `/folders/{uid}/parents`, including the requested folder. */
export function useFolderPath(folderUid: string | undefined): string[] | undefined {
  const { data } = useGetFolderParentsQuery(folderUid ? { name: folderUid } : skipToken);
  return data?.items.map((folder: FolderInfo) => folder.title);
}

export function useFolderAlertRuleCount(folderUid: string | undefined): number | undefined {
  return useFolderCounts(folderUid)?.alertrules;
}

export function useFolderRecordingRuleCount(folderUid: string | undefined): number | undefined {
  return useFolderCounts(folderUid)?.recordingrules;
}

/**
 * Re-reads folder counts and the folder listing after a rule was created, deleted or paused: a
 * rule change moves both the counts and which folders hold rules. The folder API is a separate
 * RTK Query API from the rules one, so the rule mutations' own invalidation does not reach it.
 */
export function useInvalidateFolderData() {
  const dispatch = useDispatch();
  return useCallback(() => {
    dispatch(folderAPI.util.invalidateTags(['Folder']));
  }, [dispatch]);
}

function useFolderCounts(folderUid: string | undefined): Record<string, number> | undefined {
  // Counts change when a rule is created or duplicated in the editor, outside these queries.
  const { data } = useGetFolderCountsQuery(folderUid ? { name: folderUid } : skipToken, {
    refetchOnMountOrArgChange: true,
  });
  return data ? getParsedCounts(data.counts) : undefined;
}
