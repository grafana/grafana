import { PageLayoutType } from '@grafana/data';
import { Alert, Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { getMessageFromError, getStatusFromError } from 'app/core/utils/errors';
import { LoadError } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';

export function DashboardPageError({ error }: { error: Error | LoadError }) {
  const status = getStatusFromError(error);
  const message = getMessageFromError(error);
  return (
    <Page navId="dashboards/browse" layout={PageLayoutType.Canvas} pageNav={{ text: 'Not found' }}>
      <Box paddingY={4} display="flex" direction="column" alignItems="center">
        {status === 404 ? (
          <EntityNotFound entity="Dashboard" />
        ) : (
          <Alert title="Dashboard failed to load" severity="error" data-testid="dashboard-page-error">
            {message}
          </Alert>
        )}
      </Box>
    </Page>
  );
}
