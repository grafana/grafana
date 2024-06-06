import React from 'react';

import { Alert, Button, Stack } from '@grafana/ui';

const PUBLIC_DASHBOARD_URL = 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/';
export const PublicDashboardAlert = () => (
  <Alert title="" severity="info" bottomSpacing={0}>
    <Stack justifyContent="space-between" gap={2} alignItems="center">
      Sharing this dashboard externally makes it entirely accessible to anyone with the link.
      <Button variant="secondary" onClick={() => window.open(PUBLIC_DASHBOARD_URL, '_blank')} type="button">
        Learn more
      </Button>
    </Stack>
  </Alert>
);
