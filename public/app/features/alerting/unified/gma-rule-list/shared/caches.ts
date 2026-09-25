import { type FolderInfo, generatedAPI as folderAPI } from '@grafana/api-clients/rtkq/folder/v1beta1';
import {
  type AlertRule,
  type RecordingRule,
  generatedAPI as rulesAPI,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { getParsedCounts } from 'app/api/clients/folder/v1beta1/utils';
import { dispatch } from 'app/store/store';

import { type RuleResourceState } from '../actions/types';

import { EnrichmentCache, useEnrichmentEntry, useEnrichmentState } from './enrichmentCache';

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

/** Full `AlertRule` resource, loaded only for provenance and action capabilities the search
 * response can't provide yet - rows stay presentation-only and never fetch this themselves. */
export const fullAlertRuleCache = new EnrichmentCache<string, AlertRule>((uid) =>
  dispatch(rulesAPI.endpoints.getAlertRule.initiate({ name: uid })).unwrap()
);

/** Same as fullAlertRuleCache, for Recording rules. */
export const fullRecordingRuleCache = new EnrichmentCache<string, RecordingRule>((uid) =>
  dispatch(rulesAPI.endpoints.getRecordingRule.initiate({ name: uid })).unwrap()
);

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

export function useFullAlertRule(uid: string | undefined): AlertRule | undefined {
  return useEnrichmentEntry(fullAlertRuleCache, uid);
}

/** Full-resource fetch state for the Alert rule action menu/provisioning badge - distinguishes
 * still-loading from failed, which a bare value can't. */
export function useFullAlertRuleState(uid: string): RuleResourceState<AlertRule> {
  const state = useEnrichmentState(fullAlertRuleCache, uid);
  return state.status === 'loaded' ? { status: 'loaded', rule: state.value } : { status: state.status };
}

export function useFullRecordingRuleState(uid: string): RuleResourceState<RecordingRule> {
  const state = useEnrichmentState(fullRecordingRuleCache, uid);
  return state.status === 'loaded' ? { status: 'loaded', rule: state.value } : { status: state.status };
}

/** Called from a rule row's onMutated callback so a stale full-resource fetch (paused state,
 * provenance, etc.) doesn't outlive the mutation that changed it. */
export function invalidateFullAlertRule(uid: string): void {
  fullAlertRuleCache.invalidate(uid);
}

export function invalidateFullRecordingRule(uid: string): void {
  fullRecordingRuleCache.invalidate(uid);
}

/** Test-only: clears every module-level cache so tests don't see entries from a previous test. */
export function clearAllEnrichmentCaches(): void {
  folderPathCache.clear();
  folderCountsCache.clear();
  fullAlertRuleCache.clear();
  fullRecordingRuleCache.clear();
}
