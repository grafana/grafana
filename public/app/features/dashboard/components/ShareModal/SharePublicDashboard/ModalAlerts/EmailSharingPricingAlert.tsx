import { Alert, Button, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

const EMAIL_SHARING_URL = 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/#email-sharing';

export function EmailSharingPricingAlert() {
  return (
    <Alert title="" severity="info" bottomSpacing={0}>
      <Stack justifyContent="space-between" gap={2} alignItems="center">
        <Trans i18nKey="public-dashboard.email-sharing.alert-text">
          Effective immediately, sharing public dashboards by email incurs a cost per active user. Going forward, you’ll
          be prompted for payment whenever you add new users to your dashboard.
        </Trans>
        <Button variant="secondary" onClick={() => window.open(EMAIL_SHARING_URL, '_blank')} type="button">
          <Trans i18nKey="public-dashboard.email-sharing.learn-more-button">Learn more</Trans>
        </Button>
      </Stack>
    </Alert>
  );
}
