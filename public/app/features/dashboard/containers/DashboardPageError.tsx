import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Box, EmptyState, Text, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { getMessageFromError, getStatusFromError } from 'app/core/utils/errors';

interface DashboardPageErrorProps {
  error: unknown;
  type?: string;
  isProvisioned?: boolean;
}

export function DashboardPageError({ error, type, isProvisioned }: DashboardPageErrorProps) {
  const message = getMessageFromError(error);

  if (isProvisioned) {
    return (
      <Page
        navId="dashboards/browse"
        pageNav={{ text: t('dashboard.dashboard-page-error.provisioning-title', 'Dashboard preview') }}
      >
        <Page.Contents>
          <EmptyState
            variant="not-found"
            message={t('dashboard.dashboard-page-error.provisioning-message', 'Dashboard preview could not be loaded')}
          >
            <Text element="p" color="secondary">
              {message}
            </Text>
            <TextLink href="/dashboards">
              {t('dashboard.dashboard-page-error.back-to-dashboards', 'Back to dashboards')}
            </TextLink>
          </EmptyState>
        </Page.Contents>
      </Page>
    );
  }

  const status = getStatusFromError(error);
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
