import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

const PUBLIC_DASHBOARD_URL =
  'https://grafana.com/docs/grafana/next/dashboards/share-dashboards-panels/shared-dashboards';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareExternally;

export const PublicDashboardAlert = () => (
  <Alert title="" severity="info" bottomSpacing={0} data-testid={selectors.publicAlert}>
    <Stack justifyContent="space-between" gap={2} alignItems="center">
      <Trans i18nKey="public-dashboard.public-sharing.alert-text">
        Sharing this dashboard externally makes it entirely accessible to anyone with the link.
      </Trans>
      <Button variant="secondary" onClick={() => window.open(PUBLIC_DASHBOARD_URL, '_blank')} type="button">
        <Trans i18nKey="public-dashboard.public-sharing.learn-more-button">Learn more</Trans>
      </Button>
    </Stack>
  </Alert>
);
