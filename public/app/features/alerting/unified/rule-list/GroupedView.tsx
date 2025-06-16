import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Stack } from '@grafana/ui';
import { DataSourceRulesSourceIdentifier } from 'app/types/unified-alerting';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { GrafanaRulesSource, getExternalRulesSources } from '../utils/datasource';

import { PaginatedDataSourceLoader } from './PaginatedDataSourceLoader';
import { PaginatedGrafanaLoader } from './PaginatedGrafanaLoader';
import { DataSourceErrorBoundary } from './components/DataSourceErrorBoundary';
import { DataSourceSection } from './components/DataSourceSection';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

interface GroupedViewProps {
  groupFilter?: string;
  namespaceFilter?: string;
}

export function GroupedView({ groupFilter, namespaceFilter }: GroupedViewProps) {
  const externalRuleSources = useMemo(() => getExternalRulesSources(), []);

  return (
    <Stack direction="column" gap={1} role="list">
      <DataSourceErrorBoundary rulesSourceIdentifier={GrafanaRulesSource}>
        <PaginatedGrafanaLoader
          groupFilter={groupFilter}
          namespaceFilter={namespaceFilter}
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
          />
        );
      })}
    </Stack>
  );
}

interface DataSourceLoaderProps {
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
  groupFilter?: string;
  namespaceFilter?: string;
}

export function GrafanaDataSourceLoader() {
  return <DataSourceSection name="Grafana" application="grafana" uid="grafana" isLoading={true} />;
}

function DataSourceLoader({ rulesSourceIdentifier, groupFilter, namespaceFilter }: DataSourceLoaderProps) {
  const { data: dataSourceInfo, isLoading, error } = useDiscoverDsFeaturesQuery({ uid: rulesSourceIdentifier.uid });

  const { uid, name } = rulesSourceIdentifier;

  if (isLoading) {
    return <DataSourceSection loader={<Skeleton width={250} height={16} />} uid={uid} name={name} />;
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
        />
      </DataSourceErrorBoundary>
    );
  }

  return null;
}
