import { type ResourceStats } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { useGetFolderCountsQuery } from 'app/api/clients/folder/v1beta1';

export interface FolderRuleCounts {
  alertRuleCount: number;
  recordingRuleCount: number;
  isLoading: boolean;
}

/**
 * Per-folder alerting + recording rule counts from the folders `/counts` subresource.
 * Counts are DIRECT (the folder's own rules, not descendants). Recording counts require the
 * backend `countedKinds` to include recordingrules — they read as 0 otherwise.
 */
export function useK8sFolderCounts(folderUid: string): FolderRuleCounts {
  const { data, isLoading } = useGetFolderCountsQuery({ name: folderUid });

  const counts = data?.counts ?? [];

  return {
    alertRuleCount: maxCountFor(counts, 'alertrules'),
    recordingRuleCount: maxCountFor(counts, 'recordingrules'),
    isLoading,
  };
}

/**
 * A resource's count can be reported by more than one provider — the unified search index group
 * (`rules.alerting.grafana.app`) and the legacy `sql-fallback` group. One of them may be 0 when the
 * index isn't populated, so take the highest reported count rather than preferring a single group.
 */
function maxCountFor(counts: ResourceStats[], resource: string): number {
  return counts.reduce((max, stat) => (stat.resource === resource ? Math.max(max, stat.count) : max), 0);
}
