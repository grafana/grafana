import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Stack } from '@grafana/ui';
import { ExternalRulesSourceIdentifier } from 'app/types/unified-alerting';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { getExternalRulesSources } from '../utils/datasource';

import { PaginatedDataSourceLoader } from './PaginatedDataSourceLoader';
import { PaginatedGrafanaLoader } from './PaginatedGrafanaLoader';
import { DataSourceSection } from './components/DataSourceSection';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
export const GROUP_PAGE_SIZE = 40;

export function GroupedView() {
  const externalRuleSources = useMemo(() => getExternalRulesSources(), []);

  return (
    <Stack direction="column" gap={1} role="list">
      <PaginatedGrafanaLoader />
      {externalRuleSources.map((ruleSource) => {
        return <DataSourceLoader key={ruleSource.uid} rulesSourceIdentifier={ruleSource} />;
      })}
    </Stack>
  );
}

interface DataSourceLoaderProps {
  rulesSourceIdentifier: ExternalRulesSourceIdentifier;
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
      <PaginatedDataSourceLoader
        key={rulesSourceIdentifier.uid}
        rulesSourceIdentifier={rulesSourceIdentifier}
        application={dataSourceInfo.application}
      />
    );
  }

  return null;
}
