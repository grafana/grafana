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

export function GroupedView() {
  const externalRuleSources = useMemo(() => getExternalRulesSources(), []);

  return (
    <Stack direction="column" gap={1} role="list">
      <DataSourceErrorBoundary rulesSourceIdentifier={GrafanaRulesSource}>
        <PaginatedGrafanaLoader />
      </DataSourceErrorBoundary>
      {externalRuleSources.map((ruleSource) => {
        return <DataSourceLoader key={ruleSource.uid} rulesSourceIdentifier={ruleSource} />;
      })}
    </Stack>
  );
}

interface DataSourceLoaderProps {
  rulesSourceIdentifier: DataSourceRulesSourceIdentifier;
}

export function GrafanaDataSourceLoader() {
  return <DataSourceSection name="Grafana" application="grafana" uid="grafana" isLoading={true} />;
}

function DataSourceLoader({ rulesSourceIdentifier }: DataSourceLoaderProps) {
  const { data: dataSourceInfo, isLoading } = useDiscoverDsFeaturesQuery({ uid: rulesSourceIdentifier.uid });

  const { uid, name } = rulesSourceIdentifier;

  if (isLoading) {
    return <DataSourceSection loader={<Skeleton width={250} height={16} />} uid={uid} name={name} />;
  }

  // 2. grab prometheus rule groups with max_groups if supported
  if (dataSourceInfo) {
    return (
      <DataSourceErrorBoundary rulesSourceIdentifier={rulesSourceIdentifier}>
        <PaginatedDataSourceLoader
          key={rulesSourceIdentifier.uid}
          rulesSourceIdentifier={rulesSourceIdentifier}
          application={dataSourceInfo.application}
        />
      </DataSourceErrorBoundary>
    );
  }

  return null;
}
