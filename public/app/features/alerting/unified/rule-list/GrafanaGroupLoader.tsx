import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';

import { prometheusApi } from '../api/prometheusApi';
import { RULE_LIST_POLL_INTERVAL_MS } from '../utils/constants';

import { GrafanaRuleListItem } from './GrafanaRuleListItem';
import { AlertRuleListItemSkeleton } from './components/AlertRuleListItemLoader';

// const { useGetGrafanaRulerGroupQuery } = alertRuleApi;
const { useGetGrafanaGroupsQuery } = prometheusApi;

export interface GrafanaGroupLoaderProps {
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
  /**
   * Used to display the same number of skeletons as there are rules
   * The number of rules is typically known from paginated Prometheus response
   * Ruler response might contain different number of rules, but in most cases what we get from Prometheus is fine
   */
  expectedRulesCount?: number;
}

/**
 * Loads an evaluation group from Prometheus and Ruler endpoints.
 * Displays a loading skeleton while the data is being fetched.
 * Polls the Prometheus endpoint every 20 seconds to refresh the data.
 */
export function GrafanaGroupLoader({
  groupIdentifier,
  namespaceName,
  expectedRulesCount = 3, // 3 is a random number. Usually we get the number of rules from Prometheus response
}: GrafanaGroupLoaderProps) {
  const { data: promResponse, isLoading: isPromResponseLoading } = useGetGrafanaGroupsQuery(
    {
      folderUid: groupIdentifier.namespace.uid,
      groupName: groupIdentifier.groupName,
      limitAlerts: 0,
    },
    { pollingInterval: RULE_LIST_POLL_INTERVAL_MS }
  );

  const isLoading = isPromResponseLoading;
  if (isLoading) {
    return (
      <>
        {Array.from({ length: expectedRulesCount }).map((_, index) => (
          <AlertRuleListItemSkeleton key={index} />
        ))}
      </>
    );
  }

  if (!promResponse) {
    return (
      <Alert
        title={t(
          'alerting.group-loader.group-load-failed',
          'Failed to load rules from group {{ groupName }} in {{ namespaceName }}',
          { groupName: groupIdentifier.groupName, namespaceName }
        )}
        severity="error"
      />
    );
  }

  return (
    <>
      {promResponse.data.groups.at(0)?.rules.map((promRule) => {
        return (
          <GrafanaRuleListItem
            key={promRule.uid}
            rule={promRule}
            groupIdentifier={groupIdentifier}
            namespaceName={namespaceName}
            // we don't show the location again for rules, it's redundant because they are shown in a folder > group hierarchy
          />
        );
      })}
    </>
  );
}
