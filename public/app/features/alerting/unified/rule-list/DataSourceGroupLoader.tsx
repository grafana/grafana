import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, useStyles2 } from '@grafana/ui';
import { DataSourceRuleGroupIdentifier } from 'app/types/unified-alerting';
import {
  PromRuleDTO,
  PromRuleGroupDTO,
  RulerCloudRuleDTO,
  RulerRuleGroupDTO,
  RulesSourceApplication,
} from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { prometheusApi } from '../api/prometheusApi';
import { useContinuousPagination } from '../hooks/usePagination';
import { DEFAULT_PER_PAGE_PAGINATION_RULES_PER_GROUP, RULE_LIST_POLL_INTERVAL_MS } from '../utils/constants';
import { hashRule } from '../utils/rule-id';
import { getRuleName, isCloudRulerGroup } from '../utils/rules';

import { DataSourceRuleListItem } from './DataSourceRuleListItem';
import { RuleOperationListItem } from './components/AlertRuleListItem';
import { AlertRuleListItemSkeleton } from './components/AlertRuleListItemLoader';
import { LoadMoreButton } from './components/LoadMoreButton';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';
import { matchRulesGroup } from './ruleMatching';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const { useGetGroupsQuery } = prometheusApi;
const { useGetRuleGroupForNamespaceQuery } = alertRuleApi;

export interface DataSourceGroupLoaderProps {
  groupIdentifier: DataSourceRuleGroupIdentifier;
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
export function DataSourceGroupLoader({ groupIdentifier, expectedRulesCount = 3 }: DataSourceGroupLoaderProps) {
  const { namespace, groupName } = groupIdentifier;
  const namespaceName = namespace.name;

  const {
    data: promResponse,
    isLoading: isPromResponseLoading,
    isError: isPromResponseError,
  } = useGetGroupsQuery(
    {
      ruleSource: { uid: groupIdentifier.rulesSource.uid },
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
    error: rulerGroupError,
    isFetching: isRulerGroupFetching,
    isError: isRulerGroupError,
  } = useGetRuleGroupForNamespaceQuery(
    dsFeatures?.rulerConfig
      ? {
          rulerConfig: dsFeatures?.rulerConfig,
          namespace: namespaceName,
          group: groupName,
        }
      : skipToken
  );

  const isLoading = isPromResponseLoading || isDsFeaturesLoading || isRulerGroupFetching;
  if (isLoading) {
    return (
      <>
        {Array.from({ length: expectedRulesCount }).map((_, index) => (
          <AlertRuleListItemSkeleton key={index} />
        ))}
      </>
    );
  }

  const isError = isPromResponseError || isDsFeaturesError || isRulerGroupError;
  if (isError) {
    if (isFetchError(rulerGroupError) && rulerGroupError.status === 404) {
      return (
        <Alert severity="warning" title={t('alerting.ds-group-loader.group-deleting', 'The group is being deleted')} />
      );
    }

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

  // There should be always only one group in the response but some Prometheus-compatible data sources
  // implement different filter parameters
  const promGroup = promResponse?.data.groups.find((g) => g.file === namespaceName && g.name === groupName);
  if (dsFeatures?.rulerConfig && rulerGroup && isCloudRulerGroup(rulerGroup) && promGroup) {
    return (
      <RulerBasedGroupRules
        groupIdentifier={groupIdentifier}
        promGroup={promGroup}
        rulerGroup={rulerGroup}
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
            showLocation={false}
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
        'Failed to load rules from group {{ groupName }} in {{ namespaceName }}',
        { groupName, namespaceName }
      )}
      severity="warning"
    />
  );
}

interface RulerBasedGroupRulesProps {
  groupIdentifier: DataSourceRuleGroupIdentifier;
  promGroup: PromRuleGroupDTO<PromRuleDTO>;
  rulerGroup: RulerRuleGroupDTO<RulerCloudRuleDTO>;
  application: RulesSourceApplication;
}

export function RulerBasedGroupRules({
  groupIdentifier,
  application,
  promGroup,
  rulerGroup,
}: RulerBasedGroupRulesProps) {
  const styles = useStyles2(getStyles);
  const { namespace, groupName } = groupIdentifier;

  const { matches, promOnlyRules } = useMemo(() => {
    return matchRulesGroup(rulerGroup, promGroup);
  }, [promGroup, rulerGroup]);

  const { pageItems, hasMore, loadMore } = useContinuousPagination(
    rulerGroup.rules,
    DEFAULT_PER_PAGE_PAGINATION_RULES_PER_GROUP
  );

  return (
    <>
      {pageItems.map((rulerRule) => {
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
            showLocation={false}
          />
        ) : (
          <RuleOperationListItem
            key={getRuleName(rulerRule)}
            name={getRuleName(rulerRule)}
            namespace={namespace.name}
            group={groupName}
            rulesSource={groupIdentifier.rulesSource}
            application={application}
            operation="creating"
            showLocation={false}
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
          operation="deleting"
          showLocation={false}
        />
      ))}
      {hasMore && (
        <li aria-selected="false" role="treeitem" className={styles.loadMoreWrapper}>
          <LoadMoreButton onClick={loadMore} />
        </li>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  loadMoreWrapper: css({
    listStyle: 'none',
    paddingTop: theme.spacing(1),
  }),
});
