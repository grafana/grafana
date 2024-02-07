import React from 'react';

import { Stack, Text } from '@grafana/ui';

export const MetricsHeader = () => (
  <Stack direction="column" gap={1}>
    <Text variant="h1">Metrics</Text>
    <Text color="secondary">Explore your Prometheus-compatible metrics without writing a query</Text>
  </Stack>
);
