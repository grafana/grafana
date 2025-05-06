import { useMemo } from 'react';

import { Alert } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { logWarning } from '../Analytics';
import { alertRuleApi } from '../api/alertRuleApi';
import { prometheusApi } from '../api/prometheusApi';
import { RULE_LIST_POLL_INTERVAL_MS } from '../utils/constants';
import { GrafanaRulesSource } from '../utils/datasource';

import { GrafanaRuleListItem } from './GrafanaRuleLoader';
import { RuleOperationListItem } from './components/AlertRuleListItem';
import { AlertRuleListItemSkeleton } from './components/AlertRuleListItemLoader';
import { RuleOperation } from './components/RuleListIcon';

const { useGetGrafanaRulerGroupQuery } = alertRuleApi;
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
    },
    { pollingInterval: RULE_LIST_POLL_INTERVAL_MS }
  );
  const { data: rulerResponse, isLoading: isRulerGroupLoading } = useGetGrafanaRulerGroupQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });

  const { matches, promOnlyRules } = useMemo(() => {
    const promRules = promResponse?.data.groups.at(0)?.rules ?? [];
    const rulerRules = rulerResponse?.rules ?? [];

    return matchRules(promRules, rulerRules);
  }, [promResponse, rulerResponse]);

  const isLoading = isPromResponseLoading || isRulerGroupLoading;
  if (isLoading) {
    return (
      <>
        {Array.from({ length: expectedRulesCount }).map((_, index) => (
          <AlertRuleListItemSkeleton key={index} />
        ))}
      </>
    );
  }

  if (!rulerResponse || !promResponse) {
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
      {rulerResponse.rules.map((rulerRule) => {
        const promRule = matches.get(rulerRule);

        if (!promRule) {
          return (
            <GrafanaRuleListItem
              key={rulerRule.grafana_alert.uid}
              rule={promRule}
              rulerRule={rulerRule}
              groupIdentifier={groupIdentifier}
              namespaceName={namespaceName}
              operation={RuleOperation.Creating}
            />
          );
        }

        return (
          <GrafanaRuleListItem
            key={promRule.uid}
            rule={promRule}
            rulerRule={rulerRule}
            groupIdentifier={groupIdentifier}
            namespaceName={namespaceName}
          />
        );
      })}
      {promOnlyRules.map((rule) => (
        <RuleOperationListItem
          key={rule.uid}
          name={rule.name}
          namespace={namespaceName}
          group={groupIdentifier.groupName}
          rulesSource={GrafanaRulesSource}
          application="grafana"
          operation={RuleOperation.Deleting}
        />
      ))}
    </>
  );
}

interface MatchingResult {
  matches: Map<RulerGrafanaRuleDTO, GrafanaPromRuleDTO>;
  /**
   * Rules that were already removed from the Ruler but the changes has not been yet propagated to Prometheus
   */
  promOnlyRules: GrafanaPromRuleDTO[];
}

export function matchRules(
  promRules: GrafanaPromRuleDTO[],
  rulerRules: RulerGrafanaRuleDTO[]
): Readonly<MatchingResult> {
  const promRulesMap = new Map(promRules.map((rule) => [rule.uid, rule]));

  const matchingResult = rulerRules.reduce<MatchingResult>(
    (acc, rulerRule) => {
      const { matches } = acc;
      const promRule = promRulesMap.get(rulerRule.grafana_alert.uid);
      if (promRule) {
        matches.set(rulerRule, promRule);
        promRulesMap.delete(rulerRule.grafana_alert.uid);
      }
      return acc;
    },
    { matches: new Map(), promOnlyRules: [] }
  );

  matchingResult.promOnlyRules.push(...promRulesMap.values());

  if (matchingResult.promOnlyRules.length > 0) {
    // Grafana Prometheus rules should be strongly consistent now so each Ruler rule should have a matching Prometheus rule
    // If not, log it as a warning
    logWarning('Grafana Managed Rules: No matching Prometheus rule found for Ruler rule', {
      promOnlyRulesCount: matchingResult.promOnlyRules.length.toString(),
    });
  }

  return matchingResult;
}
