import React from 'react';

import { Alert, Button, Stack } from '@grafana/ui';

const EMAIL_SHARING_URL = 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/#email-sharing';

export function EmailSharingPricingAlert() {
  return (
    <Alert title="" severity="info" bottomSpacing={0}>
      <Stack justifyContent="space-between" gap={2} alignItems="center">
        Effective immediately, sharing public dashboards by email incurs a cost per active user. Going forward, you’ll
        be prompted for payment whenever you add new users to your dashboard.
        <Button variant="secondary" onClick={() => window.open(EMAIL_SHARING_URL, '_blank')} type="button">
          Learn more
        </Button>
      </Stack>
    </Alert>
  );
}
