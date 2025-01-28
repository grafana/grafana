import { intersection } from 'lodash';
import { useMemo } from 'react';

import { Alert } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { DataSourceRuleGroupIdentifier } from 'app/types/unified-alerting';
import { PromRuleDTO, RulerCloudRuleDTO, RulerRuleDTO, RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { prometheusApi } from '../api/prometheusApi';
import { RULE_LIST_POLL_INTERVAL_MS } from '../utils/constants';
import { getPromRuleFingerprint, getRulerRuleFingerprint, hashRule } from '../utils/rule-id';
import { isAlertingRulerRule, isCloudRulerRule, isRecordingRulerRule } from '../utils/rules';

import { DataSourceRuleListItem } from './DataSourceRuleListItem';
import { RuleOperationListItem } from './components/AlertRuleListItem';
import { AlertRuleListItemLoader } from './components/AlertRuleListItemLoader';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';
import { RuleOperation } from './components/RuleListIcon';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const { useGetGroupsQuery } = prometheusApi;
const { useGetRuleGroupForNamespaceQuery } = alertRuleApi;

export interface DataSourceGroupLoaderProps {
  groupIdentifier: DataSourceRuleGroupIdentifier;
  expectedRulesCount?: number;
}

export function DataSourceGroupLoader({ groupIdentifier, expectedRulesCount = 3 }: DataSourceGroupLoaderProps) {
  const { namespace, groupName } = groupIdentifier;
  const namespaceName = namespace.name;

  const {
    data: promResponse,
    isLoading: isPromResponseLoading,
    isError: isPromResponseError,
  } = useGetGroupsQuery(
    {
      ruleSource: groupIdentifier.rulesSource,
      namespace: namespaceName,
      groupName: groupName,
    },
    { pollingInterval: RULE_LIST_POLL_INTERVAL_MS }
  );

  const {
    data: dsFeatures,
    isLoading: isDsFeaturesLoading,
    isError: isDsFeaturesError,
  } = useDiscoverDsFeaturesQuery({
    uid: groupIdentifier.rulesSource.uid,
  });

  const {
    data: rulerGroup,
    isFetching: isRulerGroupFetching,
    isError: isRulerGroupError,
  } = useGetRuleGroupForNamespaceQuery(
    {
      rulerConfig: dsFeatures?.rulerConfig!,
      namespace: namespaceName,
      group: groupName,
    },
    { skip: !dsFeatures?.rulerConfig }
  );

  const isLoading = isPromResponseLoading || isDsFeaturesLoading || isRulerGroupFetching;
  if (isLoading) {
    return (
      <>
        {Array.from({ length: expectedRulesCount }).map((_, index) => (
          <AlertRuleListItemLoader key={index} />
        ))}
      </>
    );
  }

  const isError = isPromResponseError || isDsFeaturesError || isRulerGroupError;
  if (isError) {
    return (
      <Alert
        title={t(
          'alerting.ds-group-loader.group-load-failed',
          'Failed to load rules from group {{ groupName }} in {{ namespaceName }}',
          { groupName, namespaceName }
        )}
        severity="error"
      />
    );
  }

  const promGroup = promResponse?.data.groups.find((g) => g.file === namespaceName && g.name === groupName);
  if (dsFeatures?.rulerConfig && rulerGroup && promGroup) {
    // There should be always only one group in the response but some Prometheus-compatible data sources
    // implement different filter parameters
    return (
      <RulerEnabledDataSourceGroupLoader
        groupIdentifier={groupIdentifier}
        promRules={promGroup.rules}
        // Filter is just for typescript. We should never have other rule type in this component
        // Grafana rules are handled in a different component
        rulerRules={rulerGroup.rules.filter(isCloudRulerRule)}
        application={dsFeatures.application}
      />
    );
  }

  // Data source without ruler
  if (promGroup) {
    return (
      <>
        {promGroup.rules.map((rule) => (
          <DataSourceRuleListItem
            key={hashRule(rule)}
            rule={rule}
            groupIdentifier={groupIdentifier}
            application={dsFeatures?.application}
          />
        ))}
      </>
    );
  }

  // This should never happen
  return (
    <Alert
      title={t(
        'alerting.ds-group-loader.group-load-failed',
        'Cannot find rules for group {{ groupName }} in {{ namespaceName }}',
        { groupName, namespaceName }
      )}
      severity="warning"
    />
  );
}

interface RulerEnabledDataSourceGroupLoaderProps extends DataSourceGroupLoaderProps {
  promRules: PromRuleDTO[];
  rulerRules: RulerCloudRuleDTO[];
  application: RulesSourceApplication;
}

export function RulerEnabledDataSourceGroupLoader({
  groupIdentifier,
  application,
  promRules,
  rulerRules,
}: RulerEnabledDataSourceGroupLoaderProps) {
  const { namespace, groupName } = groupIdentifier;

  const { matches, promOnlyRules } = useMemo(() => {
    return matchRules(rulerRules, promRules);
  }, [promRules, rulerRules]);

  return (
    <>
      {rulerRules.map((rulerRule) => {
        const promRule = matches.get(rulerRule);

        return promRule ? (
          <DataSourceRuleListItem
            key={hashRule(promRule)}
            rule={promRule}
            rulerRule={rulerRule}
            groupIdentifier={groupIdentifier}
            application={application}
            actions={
              <RuleActionsButtons rule={rulerRule} promRule={promRule} groupIdentifier={groupIdentifier} compact />
            }
          />
        ) : (
          <RuleOperationListItem
            key={getRuleName(rulerRule)}
            name={getRuleName(rulerRule)}
            namespace={namespace.name}
            group={groupName}
            rulesSource={groupIdentifier.rulesSource}
            application={application}
            operation={RuleOperation.Creating}
          />
        );
      })}
      {promOnlyRules.map((rule) => (
        <RuleOperationListItem
          key={rule.name}
          name={rule.name}
          namespace={namespace.name}
          group={groupName}
          rulesSource={groupIdentifier.rulesSource}
          application={application}
          operation={RuleOperation.Deleting}
        />
      ))}
    </>
  );
}

function getRuleName(rule: RulerRuleDTO): string {
  if (isAlertingRulerRule(rule)) {
    return rule.alert;
  }
  if (isRecordingRulerRule(rule)) {
    return rule.record;
  }
  return '';
}

interface MatchingResult {
  matches: Map<RulerRuleDTO, PromRuleDTO>;
  promOnlyRules: PromRuleDTO[];
}

export function matchRules(rulerRules: RulerCloudRuleDTO[], promRules: PromRuleDTO[]): MatchingResult {
  const promRulesByHashWithQuery = new Map(promRules.map((rule) => [getPromRuleIdentifier(rule, true), rule]));
  const promRulesByHashWithoutQuery = new Map(promRules.map((rule) => [getPromRuleIdentifier(rule, false), rule]));

  const matchingResult = rulerRules.reduce<MatchingResult>(
    (acc, rulerRule) => {
      const { matches } = acc;

      // We try to match including the query first, if it fails we try without it
      const rulerBasedIdentifier = getRulerRuleIdentifier(rulerRule, true);
      const promRuleMatchedWithQuery = promRulesByHashWithQuery.get(rulerBasedIdentifier);

      if (promRuleMatchedWithQuery) {
        matches.set(rulerRule, promRuleMatchedWithQuery);
        promRulesByHashWithQuery.delete(rulerBasedIdentifier);
        return acc;
      }

      const rulerBasedIdentifierWithoutQuery = getRulerRuleIdentifier(rulerRule, false);
      const promRuleMatchedWithoutQuery = promRulesByHashWithoutQuery.get(rulerBasedIdentifierWithoutQuery);

      if (promRuleMatchedWithoutQuery) {
        matches.set(rulerRule, promRuleMatchedWithoutQuery);
        promRulesByHashWithoutQuery.delete(rulerBasedIdentifierWithoutQuery);
        return acc;
      }

      return acc;
    },
    { matches: new Map(), promOnlyRules: [] }
  );

  // Truly unmatched Prometheus rules are the ones which are still present in both maps
  const unmatchedPromRules = intersection(
    Array.from(promRulesByHashWithQuery.values()),
    Array.from(promRulesByHashWithoutQuery.values())
  );

  return { ...matchingResult, promOnlyRules: unmatchedPromRules };
}

function getPromRuleIdentifier(rule: PromRuleDTO, includeQuery: boolean): string {
  return getPromRuleFingerprint(rule, includeQuery).join('-');
}

function getRulerRuleIdentifier(rule: RulerCloudRuleDTO, includeQuery: boolean): string {
  return getRulerRuleFingerprint(rule, includeQuery).join('-');
}
