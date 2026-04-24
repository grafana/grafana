import { groupBy, isEmpty } from 'lodash';
import { useEffect, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { Icon, Stack, TextLink } from '@grafana/ui';
import { type DataSourceRulesSourceIdentifier, GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import { type PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { WithReturnButton } from '../../components/WithReturnButton';
import { FolderActionsButton } from '../../components/folder-actions/FolderActionsButton';
import { GrafanaNoRulesCTA } from '../../components/rules/NoRulesCTA';
import { GRAFANA_RULES_SOURCE_NAME, GrafanaRulesSource, getExternalRulesSources } from '../../utils/datasource';
import { makeFolderAlertsLink } from '../../utils/misc';
import { PaginatedDataSourceLoader } from '../PaginatedDataSourceLoader';
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

import { ChainFolderBody } from './ChainFolderBody';
import { DemoFolderSection } from './DemoFolderSection';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

interface ChainRailGroupedViewProps {
  groupFilter?: string;
  namespaceFilter?: string;
}

export function ChainRailGroupedView({ groupFilter, namespaceFilter }: ChainRailGroupedViewProps) {
  const hasFilters = Boolean(groupFilter || namespaceFilter);
  const externalRuleSources = useMemo(() => getExternalRulesSources(), []);
  const { updateState, loadingDataSources } = useDataSourceLoadingStates();

  return (
    <Stack direction="column" gap={1} role="list">
      <DataSourceErrorBoundary rulesSourceIdentifier={GrafanaRulesSource}>
        <PaginatedChainAwareLoader
          groupFilter={groupFilter}
          namespaceFilter={namespaceFilter}
          onLoadingStateChange={updateState}
          key={`${groupFilter}-${namespaceFilter}`}
        />
      </DataSourceErrorBoundary>
      {externalRuleSources.map((ruleSource) => (
        <ExternalDataSourceLoader
          key={ruleSource.uid}
          rulesSourceIdentifier={ruleSource}
          groupFilter={groupFilter}
          namespaceFilter={namespaceFilter}
          onLoadingStateChange={updateState}
        />
      ))}
      {hasFilters && !isEmpty(loadingDataSources) && <AlertRuleListItemSkeleton />}
    </Stack>
  );
}

interface LoaderProps {
  groupFilter?: string;
  namespaceFilter?: string;
  onLoadingStateChange?: (uid: string, state: DataSourceLoadState) => void;
}

function PaginatedChainAwareLoader({ groupFilter, namespaceFilter, onLoadingStateChange }: LoaderProps) {
  const filterState = { namespace: namespaceFilter, groupName: groupFilter };
  const { backendFilter } = getGrafanaFilter(filterState);

  const hasFilters = Boolean(groupFilter || namespaceFilter);
  const needsClientSideFiltering = hasGrafanaClientSideFilters(filterState);

  const grafanaGroupsGenerator = useGrafanaGroupsGenerator({
    populateCache: needsClientSideFiltering ? false : true,
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
        <DemoFolderSection />
        {Object.entries(groupsByFolder).map(([folderUid, folderGroups]) => {
          const folderName = folderGroups[0].file;
          return (
            <ListSection
              key={folderUid}
              title={
                <Stack direction="row" gap={1} alignItems="center">
                  <Icon name="folder" />{' '}
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
              <ChainFolderBody folderUid={folderUid} folderName={folderName} groups={folderGroups} />
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

interface ExternalDataSourceLoaderProps {
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
  groupFilter?: string;
  namespaceFilter?: string;
  onLoadingStateChange?: (uid: string, state: DataSourceLoadState) => void;
}

function ExternalDataSourceLoader({
  rulesSourceIdentifier,
  groupFilter,
  namespaceFilter,
  onLoadingStateChange,
}: ExternalDataSourceLoaderProps) {
  const hasFilters = Boolean(groupFilter || namespaceFilter);
  const { data: dataSourceInfo, isLoading, error } = useDiscoverDsFeaturesQuery({ uid: rulesSourceIdentifier.uid });
  const { uid, name } = rulesSourceIdentifier;

  if (hasFilters && (isLoading || Boolean(error))) {
    return null;
  }

  if (error) {
    return <DataSourceSection error={error} uid={uid} name={name} />;
  }

  if (dataSourceInfo) {
    return (
      <DataSourceErrorBoundary rulesSourceIdentifier={rulesSourceIdentifier}>
        <PaginatedDataSourceLoader
          rulesSourceIdentifier={rulesSourceIdentifier}
          application={dataSourceInfo.application}
          groupFilter={groupFilter}
          namespaceFilter={namespaceFilter}
          onLoadingStateChange={onLoadingStateChange}
        />
      </DataSourceErrorBoundary>
    );
  }

  return null;
}
