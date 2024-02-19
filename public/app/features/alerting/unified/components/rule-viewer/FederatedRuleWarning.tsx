import React from 'react';

import { Alert, Button, Stack } from '@grafana/ui';

export function FederatedRuleWarning() {
  return (
    <Alert severity="info" title="This rule is part of a federated rule group." bottomSpacing={0} topSpacing={2}>
      <Stack direction="column">
        Federated rule groups are currently an experimental feature.
        <Button fill="text" icon="book">
          <a href="https://grafana.com/docs/metrics-enterprise/latest/tenant-management/tenant-federation/#cross-tenant-alerting-and-recording-rule-federation">
            Read documentation
          </a>
        </Button>
      </Stack>
    </Alert>
  );
}
