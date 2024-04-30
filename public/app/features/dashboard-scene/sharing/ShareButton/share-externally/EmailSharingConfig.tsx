import React from 'react';

import { Alert, Button, Checkbox, Stack } from '@grafana/ui';

const EMAIL_SHARING_URL = 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/#email-sharing';

export const EmailSharingConfig = ({ onCancel }: { onCancel: () => void }) => {
  return (
    <>
      <Alert
        title=""
        severity="info"
        buttonContent={<span>Learn more</span>}
        onRemove={() => window.open(EMAIL_SHARING_URL, '_blank')}
      >
        Effective immediately, sharing public dashboards by email incurs a cost per active user. Going forward, you’ll
        be prompted for payment whenever you add new users to your dashboard.
      </Alert>
      <div>
        <Checkbox value={true} label="I understand that adding users requires payment.*" />
      </div>
      <Stack direction="row" gap={1}>
        <Button type="submit" disabled={false}>
          Accept
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={false}>
          Cancel
        </Button>
      </Stack>
    </>
  );
};
