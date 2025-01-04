import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Alert, ErrorBoundary, ErrorWithStack, Stack, Text } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { ExternalRulesSourceIdentifier, RulesSourceIdentifier } from 'app/types/unified-alerting';

import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { GrafanaRulesSource, getExternalRulesSources } from '../utils/datasource';

import { PaginatedDataSourceLoader } from './PaginatedDataSourceLoader';
import { PaginatedGrafanaLoader } from './PaginatedGrafanaLoader';
import { DataSourceSection } from './components/DataSourceSection';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

export const GROUP_PAGE_SIZE = 40;

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

/**
 * Some more exotic Prometheus data sources might not be 100% compatible with Prometheus API
 * We don't want them to break the whole page, so we wrap them in an error boundary
 */
function DataSourceErrorBoundary({
  children,
  rulesSourceIdentifier,
}: {
  children: React.ReactNode;
  rulesSourceIdentifier: RulesSourceIdentifier;
}) {
  return (
    <ErrorBoundary>
      {({ error, errorInfo }) => {
        if (error || errorInfo) {
          const { uid, name } = rulesSourceIdentifier;
          return (
            <DataSourceSection uid={uid} name={name}>
              <Alert
                title={t('alerting.rule-list.ds-error-boundary.title', 'Unable to load rules from this data source')}
              >
                <Text>Check the data source configuration. Does the data source support Prometheus API?</Text>
                <ErrorWithStack
                  error={error}
                  errorInfo={errorInfo}
                  title={t('alerting.rule-list.ds-error-boundary.title', 'Unable to load rules from this data source')}
                />
              </Alert>
            </DataSourceSection>
          );
        }
        return children;
      }}
    </ErrorBoundary>
  );
}
