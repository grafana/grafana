import { groupBy, isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { Icon, Stack, TextLink } from '@grafana/ui';
import { type GrafanaRuleGroupIdentifier, GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import {
  type GrafanaPromRuleDTO,
  type GrafanaPromRuleGroupDTO,
  type PromRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { type ChainMembership } from '../../api/chainsApi';
import { WithReturnButton } from '../../components/WithReturnButton';
import { FolderActionsButton } from '../../components/folder-actions/FolderActionsButton';
import { GrafanaNoRulesCTA } from '../../components/rules/NoRulesCTA';
import { DEMO_CHAIN_ID, DEMO_CHAIN_SIZE } from '../../mocks/fixtures/chains';
import { GRAFANA_RULES_SOURCE_NAME, GrafanaRulesSource } from '../../utils/datasource';
import { makeFolderAlertsLink } from '../../utils/misc';
import { groups as groupNav } from '../../utils/navigation';
import { isUngroupedRuleGroup } from '../../utils/rules';
import { GrafanaRuleListItem } from '../GrafanaRuleListItem';
import { GrafanaGroupActions } from '../PaginatedGrafanaLoader';
import { AlertRuleListItemSkeleton } from '../components/AlertRuleListItemLoader';
import { DataSourceErrorBoundary } from '../components/DataSourceErrorBoundary';
import { DataSourceSection } from '../components/DataSourceSection';
import { GroupIntervalIndicator } from '../components/GroupIntervalMetadata';
import { ListGroup } from '../components/ListGroup';
import { ListSection } from '../components/ListSection';
import { LoadMoreButton } from '../components/LoadMoreButton';
import { NoRulesFound } from '../components/NoRulesFound';
import { getGrafanaFilter, hasGrafanaClientSideFilters } from '../hooks/grafanaFilter';
import { toIndividualRuleGroups, useGrafanaGroupsGenerator } from '../hooks/prometheusGroupsGenerator';
import { useDataSourceLoadingReporter } from '../hooks/useDataSourceLoadingReporter';
import { type DataSourceLoadState, useDataSourceLoadingStates } from '../hooks/useDataSourceLoadingStates';
import { useLazyLoadPrometheusGroups } from '../hooks/useLazyLoadPrometheusGroups';
import { FRONTED_GROUPED_PAGE_SIZE, getApiGroupPageSize } from '../paginationLimits';

import { EvaluationChainLink } from './EvaluationChainLink';

interface GroupedRuleListViewProps {
  groupFilter?: string;
  namespaceFilter?: string;
  chainFilter?: string;
  onChainLinkClick: (chainId: string, position: number) => void;
}

/**
 * V3 variant of GroupedView: consumes already-paginated Grafana rule groups and
 * renders the same folder → group → rule hierarchy as V2's PaginatedGrafanaLoader,
 * but surfaces chain membership as an inline meta item on each rule row.
 */
export function GroupedRuleListView({
  groupFilter,
  namespaceFilter,
  chainFilter,
  onChainLinkClick,
}: GroupedRuleListViewProps) {
  const { updateState, loadingDataSources } = useDataSourceLoadingStates();
  const hasFilters = Boolean(groupFilter || namespaceFilter || chainFilter);

  return (
    <Stack direction="column" gap={1} role="list">
      <DataSourceErrorBoundary rulesSourceIdentifier={GrafanaRulesSource}>
        <GroupedGrafanaLoader
          key={`${groupFilter}-${namespaceFilter}-${chainFilter}`}
          groupFilter={groupFilter}
          namespaceFilter={namespaceFilter}
          chainFilter={chainFilter}
          onChainLinkClick={onChainLinkClick}
          onLoadingStateChange={updateState}
        />
      </DataSourceErrorBoundary>
      {hasFilters && !isEmpty(loadingDataSources) && <AlertRuleListItemSkeleton />}
    </Stack>
  );
}

interface GroupedGrafanaLoaderProps {
  groupFilter?: string;
  namespaceFilter?: string;
  chainFilter?: string;
  onChainLinkClick: (chainId: string, position: number) => void;
  onLoadingStateChange?: (uid: string, state: DataSourceLoadState) => void;
}

function GroupedGrafanaLoader({
  groupFilter,
  namespaceFilter,
  chainFilter,
  onChainLinkClick,
  onLoadingStateChange,
}: GroupedGrafanaLoaderProps) {
  const filterState = { namespace: namespaceFilter, groupName: groupFilter };
  const { backendFilter } = getGrafanaFilter(filterState);

  const hasFilters = Boolean(groupFilter || namespaceFilter || chainFilter);
  const needsClientSideFiltering = hasGrafanaClientSideFilters(filterState);

  const grafanaGroupsGenerator = useGrafanaGroupsGenerator({
    populateCache: !needsClientSideFiltering,
    limitAlerts: 0,
  });

  const apiGroupPageSize = getApiGroupPageSize(needsClientSideFiltering);

  const groupsGenerator = useRef(
    toIndividualRuleGroups(grafanaGroupsGenerator({ groupLimit: apiGroupPageSize }, backendFilter))
  );

  useEffect(() => {
    const currentGenerator = groupsGenerator.current;
    return () => {
      currentGenerator.return();
    };
  }, []);

  const filterFn = useMemo(() => {
    const { frontendFilter } = getGrafanaFilter({
      namespace: namespaceFilter,
      groupName: groupFilter,
      freeFormWords: [],
      ruleName: '',
      labels: [],
      ruleType: undefined,
      ruleState: undefined,
      ruleHealth: undefined,
      dashboardUid: undefined,
      dataSourceNames: [],
      plugins: undefined,
      contactPoint: undefined,
      ruleSource: undefined,
    });
    return (group: PromRuleGroupDTO) => frontendFilter.groupMatches(group);
  }, [namespaceFilter, groupFilter]);

  const { isLoading, groups, hasMoreGroups, fetchMoreGroups, error } = useLazyLoadPrometheusGroups(
    groupsGenerator.current,
    FRONTED_GROUPED_PAGE_SIZE,
    filterFn
  );

  useDataSourceLoadingReporter(
    GRAFANA_RULES_SOURCE_NAME,
    { isLoading, rulesCount: groups.length, error },
    onLoadingStateChange
  );

  const groupsByFolder = useMemo(() => groupBy(groups, 'folderUid'), [groups]);
  const hasNoRules = isEmpty(groups) && !isLoading;

  const folderRenderData = useMemo(() => buildGroupedRenderData(groupsByFolder), [groupsByFolder]);

  if (hasFilters && isEmpty(groups)) {
    return null;
  }

  return (
    <DataSourceSection
      name="Grafana-managed"
      application="grafana"
      uid={GrafanaRulesSourceSymbol}
      isLoading={isLoading}
      error={error}
    >
      <Stack direction="column" gap={0}>
        {folderRenderData.map(({ folderUid, folderName, groups: folderGroups }) => {
          const renderableGroups = folderGroups
            .map((entry) => ({
              ...entry,
              rules: chainFilter ? entry.rules.filter((r) => r.membership?.id === chainFilter) : entry.rules,
            }))
            .filter((entry) => entry.rules.length > 0);

          if (chainFilter && renderableGroups.length === 0) {
            return null;
          }

          return (
            <ListSection
              key={folderUid}
              title={
                <Stack direction="row" gap={1} alignItems="center">
                  <Icon name="folder" />
                  <WithReturnButton
                    title={t('alerting.rule-list.return-button.title', 'Alert rules')}
                    component={
                      <TextLink href={makeFolderAlertsLink(folderUid, folderName)} inline={false} color="primary">
                        {folderName}
                      </TextLink>
                    }
                  />
                </Stack>
              }
              actions={<FolderActionsButton folderUID={folderUid} />}
            >
              {renderableGroups.map(({ group, rules }) => (
                <GroupedRuleGroup
                  key={`${folderUid}-${group.name}`}
                  group={group}
                  folderName={folderName}
                  rules={rules}
                  // Auto-open when a chain filter is active so the matches don't sit hidden inside a collapsed group.
                  isOpen={Boolean(chainFilter)}
                  onChainLinkClick={onChainLinkClick}
                />
              ))}
            </ListSection>
          );
        })}
        {hasNoRules && !hasFilters && <GrafanaNoRulesCTA />}
        {hasNoRules && hasFilters && <NoRulesFound />}
        {hasMoreGroups && (
          <div>
            <LoadMoreButton loading={isLoading} onClick={fetchMoreGroups} />
          </div>
        )}
      </Stack>
    </DataSourceSection>
  );
}

interface GroupedRuleEntry {
  rule: GrafanaPromRuleDTO;
  membership?: ChainMembership;
}

interface GroupedGroupEntry {
  group: GrafanaPromRuleGroupDTO;
  rules: GroupedRuleEntry[];
}

interface GroupedFolderEntry {
  folderUid: string;
  folderName: string;
  groups: GroupedGroupEntry[];
}

/**
 * For the POC, tag the first DEMO_CHAIN_SIZE rules encountered as sequential
 * chain members. A real backend would return memberships keyed by rule UID.
 *
 * Iteration order depends on the insertion order of `groupsByFolder`. Lodash's
 * `groupBy` preserves insertion order, so the tagged rules remain stable across
 * renders as long as the underlying group list isn't reshuffled.
 */
function buildGroupedRenderData(groupsByFolder: Record<string, GrafanaPromRuleGroupDTO[]>): GroupedFolderEntry[] {
  let chainCounter = 0;
  return Object.entries(groupsByFolder).map(([folderUid, folderGroups]) => {
    const folderName = folderGroups[0].file;
    const groups: GroupedGroupEntry[] = folderGroups.map((group) => {
      const rules: GroupedRuleEntry[] = group.rules.map((rule) => {
        if (chainCounter < DEMO_CHAIN_SIZE) {
          chainCounter += 1;
          return {
            rule,
            membership: { id: DEMO_CHAIN_ID, position: chainCounter, total: DEMO_CHAIN_SIZE },
          };
        }
        return { rule };
      });
      return { group, rules };
    });
    return { folderUid, folderName, groups };
  });
}

interface GroupedRuleGroupProps {
  group: GrafanaPromRuleGroupDTO;
  folderName: string;
  rules: GroupedRuleEntry[];
  isOpen: boolean;
  onChainLinkClick: (chainId: string, position: number) => void;
}

function GroupedRuleGroup({ group, folderName, rules, isOpen, onChainLinkClick }: GroupedRuleGroupProps) {
  const groupIdentifier: GrafanaRuleGroupIdentifier = {
    groupName: group.name,
    namespace: { uid: group.folderUid },
    groupOrigin: 'grafana',
  };

  const detailsLink = groupNav.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, group.folderUid, group.name);

  const firstRuleName = group.rules[0]?.name ?? t('alerting.rules-group.unknown-rule', 'Unknown Rule');
  const groupDisplayName = isUngroupedRuleGroup(group.name)
    ? t('alerting.rules-group.ungrouped-suffix', '{{ruleName}} (Ungrouped)', { ruleName: firstRuleName })
    : group.name;

  return (
    <ListGroup
      name={groupDisplayName}
      metaRight={<GroupIntervalIndicator seconds={group.interval} />}
      actions={<GrafanaGroupActions folderUid={group.folderUid} groupName={group.name} />}
      href={detailsLink}
      isOpen={isOpen}
    >
      {rules.map(({ rule, membership }) => {
        const chainLink = membership ? (
          <EvaluationChainLink
            chainId={membership.id}
            position={membership.position}
            total={membership.total}
            onClick={onChainLinkClick}
          />
        ) : undefined;
        return (
          <GrafanaRuleListItem
            key={rule.uid}
            rule={rule}
            groupIdentifier={groupIdentifier}
            namespaceName={folderName}
            showLocation={false}
            chainLink={chainLink}
          />
        );
      })}
    </ListGroup>
  );
}
