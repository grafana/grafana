import { type FolderInfo, generatedAPI as folderAPI } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { getParsedCounts } from 'app/api/clients/folder/v1beta1/utils';
import { dispatch } from 'app/store/store';

import { EnrichmentCache, useEnrichmentEntry } from '../shared/enrichmentCache';

/** Root-to-folder titles from `/folders/{uid}/parents`, including the requested folder. */
export const folderPathCache = new EnrichmentCache<string, string[]>(async (folderUid) => {
  const result = await dispatch(folderAPI.endpoints.getFolderParents.initiate({ name: folderUid })).unwrap();
  return result.items.map((folder: FolderInfo) => folder.title);
});

/** Parsed `{resource: count}` map from `/folders/{uid}/counts`. */
export const folderCountsCache = new EnrichmentCache<string, Record<string, number>>(async (folderUid) => {
  const result = await dispatch(folderAPI.endpoints.getFolderCounts.initiate({ name: folderUid })).unwrap();
  return getParsedCounts(result.counts);
});

export function useFolderPath(folderUid: string | undefined): string[] | undefined {
  return useEnrichmentEntry(folderPathCache, folderUid);
}

export function useFolderAlertRuleCount(folderUid: string | undefined): number | undefined {
  const counts = useEnrichmentEntry(folderCountsCache, folderUid);
  return counts?.alertrules;
}

export function useFolderRecordingRuleCount(folderUid: string | undefined): number | undefined {
  const counts = useEnrichmentEntry(folderCountsCache, folderUid);
  return counts?.recordingrules;
}
