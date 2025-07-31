import { Trans, t } from '@grafana/i18n';
import { Alert, ErrorBoundary, ErrorWithStack, Text } from '@grafana/ui';
import { RulesSourceIdentifier } from 'app/types/unified-alerting';

import { DataSourceSection } from './DataSourceSection';

/**
 * Some more exotic Prometheus data sources might not be 100% compatible with Prometheus API
 * We don't want them to break the whole page, so we wrap them in an error boundary
 */

export function DataSourceErrorBoundary({
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
                <Text>
                  <Trans i18nKey="alerting.rule-list.ds-error-boundary.description">
                    Check the data source configuration. Does the data source support Prometheus API?
                  </Trans>
                </Text>
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
