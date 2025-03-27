import { Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export const MetricsHeader = () => (
  <Stack direction="column" gap={1}>
    <Text variant="h1">
      <Trans i18nKey="trails.metrics-header.metrics">Metrics</Trans>
    </Text>
    <Text color="secondary">
      <Trans i18nKey="trails.metrics-header.explore-prometheuscompatible-metrics-without-writing-query">
        Explore your Prometheus-compatible metrics without writing a query
      </Trans>
    </Text>
  </Stack>
);
