import { useCallback } from 'react';

import type { AlertRuleList, RecordingRuleList } from 'app/api/clients/rules/v0alpha1/endpoints.gen';
import type { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';

import {
  useLazyListAlertRulesWithPaginationQuery,
  useLazyListRecordingRulesWithPaginationQuery,
} from '../../api/k8sRulesApi';
import {
  convertK8sAlertRuleToDTO,
  convertK8sRecordingRuleToDTO,
  extractFolderUid,
  extractGroupName,
} from '../../api/k8sRulesConverters';

import type { GrafanaRuleWithOrigin } from './useFilteredRulesIterator';

const DEFAULT_PAGE_SIZE = 10000;

export function useK8sRulesGenerator() {
  const [getAlertRules] = useLazyListAlertRulesWithPaginationQuery();
  const [getRecordingRules] = useLazyListRecordingRulesWithPaginationQuery();

  return useCallback(
    async function* (): AsyncGenerator<GrafanaRuleWithOrigin[], void, unknown> {
      // Fetch alert rules with pagination
      yield* fetchAlertRulesGenerator(getAlertRules);

      // Fetch recording rules with pagination
      yield* fetchRecordingRulesGenerator(getRecordingRules);
    },
    [getAlertRules, getRecordingRules]
  );
}

/**
 * Generator function to fetch alert rules with pagination
 */
async function* fetchAlertRulesGenerator(
  getAlertRules: ReturnType<typeof useLazyListAlertRulesWithPaginationQuery>[0]
): AsyncGenerator<GrafanaRuleWithOrigin[], void, unknown> {
  let continueToken: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await getAlertRules({
        limit: DEFAULT_PAGE_SIZE,
        continueToken,
      }).unwrap();

      const alertRuleList = response as AlertRuleList;
      const rules = alertRuleList.items || [];

      // Convert K8s rules to GrafanaRuleWithOrigin format
      const convertedRules: GrafanaRuleWithOrigin[] = rules.map((rule) => {
        const dto = convertK8sAlertRuleToDTO(rule);
        const folderUid = extractFolderUid(rule);
        const groupName = extractGroupName(rule);

        const groupIdentifier: GrafanaRuleGroupIdentifier = {
          namespace: { uid: folderUid },
          groupName,
          groupOrigin: 'grafana',
        };

        return {
          rule: dto,
          groupIdentifier,
          namespaceName: folderUid, // Use folderUid as namespace name for now
          origin: 'grafana',
        };
      });

      yield convertedRules;

      // Check if there are more results
      continueToken = alertRuleList.metadata?.continue;
      hasMore = !!continueToken;
    } catch (error) {
      console.error('Error fetching alert rules from K8s API:', error);
      hasMore = false;
    }
  }
}

/**
 * Generator function to fetch recording rules with pagination
 */
async function* fetchRecordingRulesGenerator(
  getRecordingRules: ReturnType<typeof useLazyListRecordingRulesWithPaginationQuery>[0]
): AsyncGenerator<GrafanaRuleWithOrigin[], void, unknown> {
  let continueToken: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await getRecordingRules({
        limit: DEFAULT_PAGE_SIZE,
        continueToken,
      }).unwrap();

      const recordingRuleList = response as RecordingRuleList;
      const rules = recordingRuleList.items || [];

      // Convert K8s rules to GrafanaRuleWithOrigin format
      const convertedRules: GrafanaRuleWithOrigin[] = rules.map((rule) => {
        const dto = convertK8sRecordingRuleToDTO(rule);
        const folderUid = extractFolderUid(rule);
        const groupName = extractGroupName(rule);

        const groupIdentifier: GrafanaRuleGroupIdentifier = {
          namespace: { uid: folderUid },
          groupName,
          groupOrigin: 'grafana',
        };

        return {
          rule: dto,
          groupIdentifier,
          namespaceName: folderUid, // Use folderUid as namespace name for now
          origin: 'grafana',
        };
      });

      yield convertedRules;

      // Check if there are more results
      continueToken = recordingRuleList.metadata?.continue;
      hasMore = !!continueToken;
    } catch (error) {
      console.error('Error fetching recording rules from K8s API:', error);
      hasMore = false;
    }
  }
}
