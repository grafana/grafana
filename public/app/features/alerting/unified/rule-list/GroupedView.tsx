import { isEmpty } from 'lodash';
import { useEffect, useMemo } from 'react';

import { Stack } from '@grafana/ui';
import { type DataSourceRulesSourceIdentifier } from 'app/types/unified-alerting';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { useRouteProxyActive } from '../plugin-proxy/withRouteProxy';
import { GRAFANA_RULES_SOURCE_NAME, GrafanaRulesSource, getExternalRulesSources } from '../utils/datasource';

import { PaginatedDataSourceLoader } from './PaginatedDataSourceLoader';
import { PaginatedGrafanaLoader } from './PaginatedGrafanaLoader';
import { AlertRuleListItemSkeleton } from './components/AlertRuleListItemLoader';
import { DataSourceErrorBoundary } from './components/DataSourceErrorBoundary';
import { DataSourceSection } from './components/DataSourceSection';
import { HiddenDataSourcesNotice } from './components/HiddenDataSourcesNotice';
import { PendingDataSourcesNotice } from './components/PendingDataSourcesNotice';
import { type DataSourceLoadState, useDataSourceLoadingStates } from './hooks/useDataSourceLoadingStates';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

interface GroupedViewProps {
  groupFilter?: string;
  namespaceFilter?: string;
  hideEmptyDataSources?: boolean;
  onHideEmptyDataSourcesChange?: (hideEmptyDataSources: boolean) => void;
}

export function GroupedView({
  groupFilter,
  namespaceFilter,
  hideEmptyDataSources = true,
  onHideEmptyDataSourcesChange,
}: GroupedViewProps) {
  const hasFilters = Boolean(groupFilter || namespaceFilter);
  // Once the Prometheus Alerting plugin is installed it owns these, so we don't render a section
  // per data source any more. The Grafana-managed section header says where they went.
  const routeProxyActive = useRouteProxyActive();
  const externalRuleSources = useMemo(() => (routeProxyActive ? [] : getExternalRulesSources()), [routeProxyActive]);

  // Use custom hook for centralized state management
  const { updateState, loadingDataSources, dataSourcesWithNoRules, settledDataSourceUids } =
    useDataSourceLoadingStates();

  const hiddenDataSourcesCount = hideEmptyDataSources
    ? dataSourcesWithNoRules.filter((uid) => uid !== GRAFANA_RULES_SOURCE_NAME).length
    : 0;

  // A data source has no reported state at all until its feature discovery resolves, so treat
  // "not yet in the map" as pending too - otherwise data sources stuck in slow discovery would be
  // silently uncounted instead of showing up as still-being-checked.
  const settledUidSet = useMemo(() => new Set(settledDataSourceUids), [settledDataSourceUids]);
  const pendingExternalCount = externalRuleSources.filter((ds) => !settledUidSet.has(ds.uid)).length;

  return (
    <Stack direction="column" gap={1} role="list">
      <DataSourceErrorBoundary rulesSourceIdentifier={GrafanaRulesSource}>
        <PaginatedGrafanaLoader
          groupFilter={groupFilter}
          namespaceFilter={namespaceFilter}
          onLoadingStateChange={updateState}
          collapsible={!routeProxyActive}
          key={`${groupFilter}-${namespaceFilter}`}
        />
      </DataSourceErrorBoundary>
      {externalRuleSources.map((ruleSource) => {
        return (
          <DataSourceLoader
            key={ruleSource.uid}
            rulesSourceIdentifier={ruleSource}
            groupFilter={groupFilter}
            namespaceFilter={namespaceFilter}
            onLoadingStateChange={updateState}
            hideEmptyDataSources={hideEmptyDataSources}
          />
        );
      })}
      {hasFilters && !isEmpty(loadingDataSources) && <AlertRuleListItemSkeleton />}
      {!hasFilters && <PendingDataSourcesNotice count={pendingExternalCount} />}
      {!hasFilters && (
        <HiddenDataSourcesNotice
          count={hiddenDataSourcesCount}
          onShowAll={onHideEmptyDataSourcesChange ? () => onHideEmptyDataSourcesChange(false) : undefined}
        />
      )}
    </Stack>
  );
}

interface DataSourceLoaderProps {
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
  groupFilter?: string;
  namespaceFilter?: string;
  onLoadingStateChange?: (uid: string, state: DataSourceLoadState) => void;
  hideEmptyDataSources?: boolean;
}

function DataSourceLoader({
  rulesSourceIdentifier,
  groupFilter,
  namespaceFilter,
  onLoadingStateChange,
  hideEmptyDataSources,
}: DataSourceLoaderProps) {
  const hasFilters = Boolean(groupFilter || namespaceFilter);
  const { data: dataSourceInfo, isLoading, error } = useDiscoverDsFeaturesQuery({ uid: rulesSourceIdentifier.uid });

  const { uid, name } = rulesSourceIdentifier;

  // A discovery error means this data source is done loading (as far as we're concerned), but it
  // never reaches PaginatedDataSourceLoader, so nothing else would ever report that. Without this,
  // it would count as "still pending" forever in the aggregate loading state.
  useEffect(() => {
    if (error) {
      onLoadingStateChange?.(uid, { isLoading: false, rulesCount: 0, error });
    }
  }, [uid, error, onLoadingStateChange]);

  // if we are loading and there are filters configured – we shouldn't show any data source headers
  // dito for errors, we shouldn't show those when we're in filter mode
  if (hasFilters && (isLoading || Boolean(error))) {
    return null;
  }

  if (error) {
    return <DataSourceSection error={error} uid={uid} name={name} />;
  }

  // 2. grab prometheus rule groups with max_groups if supported
  if (dataSourceInfo) {
    return (
      <DataSourceErrorBoundary rulesSourceIdentifier={rulesSourceIdentifier}>
        <PaginatedDataSourceLoader
          rulesSourceIdentifier={rulesSourceIdentifier}
          application={dataSourceInfo.application}
          groupFilter={groupFilter}
          namespaceFilter={namespaceFilter}
          onLoadingStateChange={onLoadingStateChange}
          hideEmptyDataSources={hideEmptyDataSources}
        />
      </DataSourceErrorBoundary>
    );
  }

  return null;
}
