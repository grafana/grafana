import { isEmpty } from 'lodash';
import { useMemo } from 'react';

import { Stack } from '@grafana/ui';
import { DataSourceRulesSourceIdentifier } from 'app/types/unified-alerting';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { GrafanaRulesSource, getExternalRulesSources } from '../utils/datasource';

import { PaginatedDataSourceLoader } from './PaginatedDataSourceLoader';
import { PaginatedGrafanaLoader } from './PaginatedGrafanaLoader';
import { AlertRuleListItemSkeleton } from './components/AlertRuleListItemLoader';
import { DataSourceErrorBoundary } from './components/DataSourceErrorBoundary';
import { DataSourceSection } from './components/DataSourceSection';
import { type DataSourceLoadState, useDataSourceLoadingStates } from './hooks/useDataSourceLoadingStates';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

interface GroupedViewProps {
  groupFilter?: string;
  namespaceFilter?: string;
}

export function GroupedView({ groupFilter, namespaceFilter }: GroupedViewProps) {
  const hasFilters = Boolean(groupFilter || namespaceFilter);
  const externalRuleSources = useMemo(() => getExternalRulesSources(), []);

  // Use custom hook for centralized state management
  const { updateState, loadingDataSources } = useDataSourceLoadingStates();

  return (
    <Stack direction="column" gap={1} role="list">
      <DataSourceErrorBoundary rulesSourceIdentifier={GrafanaRulesSource}>
        <PaginatedGrafanaLoader
          groupFilter={groupFilter}
          namespaceFilter={namespaceFilter}
          onLoadingStateChange={updateState}
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
          />
        );
      })}
      {hasFilters && !isEmpty(loadingDataSources) && <AlertRuleListItemSkeleton />}
    </Stack>
  );
}

interface DataSourceLoaderProps {
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
  groupFilter?: string;
  namespaceFilter?: string;
  onLoadingStateChange?: (uid: string, state: DataSourceLoadState) => void;
}

export function GrafanaDataSourceLoader() {
  return <DataSourceSection name="Grafana" application="grafana" uid="grafana" isLoading={true} />;
}

function DataSourceLoader({
  rulesSourceIdentifier,
  groupFilter,
  namespaceFilter,
  onLoadingStateChange,
}: DataSourceLoaderProps) {
  const hasFilters = Boolean(groupFilter || namespaceFilter);
  const { data: dataSourceInfo, isLoading, error } = useDiscoverDsFeaturesQuery({ uid: rulesSourceIdentifier.uid });

  const { uid, name } = rulesSourceIdentifier;

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
        />
      </DataSourceErrorBoundary>
    );
  }

  return null;
}
