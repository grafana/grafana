import { groupBy, isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { Icon, Stack, TextLink } from '@grafana/ui';
import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
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
import { GrafanaRuleListItem } from '../GrafanaRuleListItem';
import { AlertRuleListItemSkeleton } from '../components/AlertRuleListItemLoader';
import { DataSourceErrorBoundary } from '../components/DataSourceErrorBoundary';
import { DataSourceSection } from '../components/DataSourceSection';
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

interface FlatRuleListViewProps {
  groupFilter?: string;
  namespaceFilter?: string;
  chainFilter?: string;
  onChainLinkClick: (chainId: string, position: number) => void;
}

/**
 * V3 flattened variant of GroupedView: renders each folder's rules as direct
 * siblings of the folder row (no evaluation-group wrapper). Chain membership
 * is surfaced as an inline meta item on each rule row.
 */
export function FlatRuleListView({
  groupFilter,
  namespaceFilter,
  chainFilter,
  onChainLinkClick,
}: FlatRuleListViewProps) {
  const { updateState, loadingDataSources } = useDataSourceLoadingStates();
  const hasFilters = Boolean(groupFilter || namespaceFilter || chainFilter);

  return (
    <Stack direction="column" gap={1} role="list">
      <DataSourceErrorBoundary rulesSourceIdentifier={GrafanaRulesSource}>
        <FlatGrafanaLoader
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

interface FlatGrafanaLoaderProps {
  groupFilter?: string;
  namespaceFilter?: string;
  chainFilter?: string;
  onChainLinkClick: (chainId: string, position: number) => void;
  onLoadingStateChange?: (uid: string, state: DataSourceLoadState) => void;
}

function FlatGrafanaLoader({
  groupFilter,
  namespaceFilter,
  chainFilter,
  onChainLinkClick,
  onLoadingStateChange,
}: FlatGrafanaLoaderProps) {
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

  const folderRenderData = useMemo(() => buildFolderRenderData(groupsByFolder), [groupsByFolder]);

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
        {folderRenderData.map(({ folderUid, folderName, rules }) => {
          const filteredRules = chainFilter ? rules.filter((r) => r.membership?.id === chainFilter) : rules;

          if (chainFilter && filteredRules.length === 0) {
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
              {filteredRules.map((info) => (
                <FlatRuleRow
                  key={`${info.folderUid}-${info.groupName}-${info.rule.uid}`}
                  info={info}
                  membership={info.membership}
                  folderName={folderName}
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

interface FolderRenderData {
  folderUid: string;
  folderName: string;
  rules: Array<FlatRuleInfo & { membership?: ChainMembership }>;
}

/**
 * For the POC, tag the first DEMO_CHAIN_SIZE rules encountered (in folder order,
 * then group order, then rule order) as sequential members of the demo chain.
 * A real backend would return memberships keyed by rule UID.
 */
function buildFolderRenderData(groupsByFolder: Record<string, GrafanaPromRuleGroupDTO[]>): FolderRenderData[] {
  let chainCounter = 0;
  return Object.entries(groupsByFolder).map(([folderUid, folderGroups]) => {
    const folderName = folderGroups[0].file;
    const rules = flattenRulesForFolder(folderGroups).map((info) => {
      if (chainCounter < DEMO_CHAIN_SIZE) {
        chainCounter += 1;
        return {
          ...info,
          membership: {
            id: DEMO_CHAIN_ID,
            position: chainCounter,
            total: DEMO_CHAIN_SIZE,
          },
        };
      }
      return info;
    });
    return { folderUid, folderName, rules };
  });
}

interface FlatRuleInfo {
  rule: GrafanaPromRuleDTO;
  groupName: string;
  folderUid: string;
}

function flattenRulesForFolder(groups: GrafanaPromRuleGroupDTO[]): FlatRuleInfo[] {
  return groups.flatMap((group) =>
    group.rules.map((rule) => ({
      rule,
      groupName: group.name,
      folderUid: group.folderUid,
    }))
  );
}

interface FlatRuleRowProps {
  info: FlatRuleInfo;
  membership?: ChainMembership;
  folderName: string;
  onChainLinkClick: (chainId: string, position: number) => void;
}

function FlatRuleRow({ info, membership, folderName, onChainLinkClick }: FlatRuleRowProps) {
  const groupIdentifier = {
    groupName: info.groupName,
    namespace: { uid: info.folderUid },
    groupOrigin: 'grafana' as const,
  };

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
      rule={info.rule}
      groupIdentifier={groupIdentifier}
      namespaceName={folderName}
      showLocation={false}
      chainLink={chainLink}
    />
  );
}
