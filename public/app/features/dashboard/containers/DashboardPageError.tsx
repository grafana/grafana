import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { getMessageFromError, getStatusFromError } from 'app/core/utils/errors';

export function DashboardPageError({ error, type }: { error: unknown; type?: string }) {
  const status = getStatusFromError(error);
  const message = getMessageFromError(error);
  const entity = type === 'snapshot' ? 'Snapshot' : 'Dashboard';

  return (
    <Page
      navId="dashboards/browse"
      layout={PageLayoutType.Canvas}
      pageNav={{ text: t('dashboard.dashboard-page-error.text.not-found', 'Not found') }}
    >
      <Box paddingY={4} display="flex" direction="column" alignItems="center">
        {status === 404 ? (
          <EntityNotFound entity={entity} />
        ) : (
          <Alert
            title={t('dashboard.errors.failed-to-load', 'Failed to load dashboard')}
            severity="error"
            data-testid="dashboard-page-error"
          >
            {message}
          </Alert>
        )}
      </Box>
    </Page>
  );
}
