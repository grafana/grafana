import { useLocation, useParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getMessageFromError, getStatusFromError } from 'app/core/utils/errors';
import DashboardScenePage from 'app/features/dashboard-scene/pages/DashboardScenePage';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { DashboardRoutes } from 'app/types';

import DashboardPage, { DashboardPageParams } from './DashboardPage';
import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from './types';

export type DashboardPageProxyProps = Omit<
  GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>,
  'match'
>;

// This proxy component is used for Dashboard -> Scenes migration.
// It will render DashboardScenePage if the user is only allowed to view the dashboard.
function DashboardPageProxy(props: DashboardPageProxyProps) {
  const forceScenes = props.queryParams.scenes === true;
  const forceOld = props.queryParams.scenes === false;
  const params = useParams<DashboardPageParams>();
  const location = useLocation();

  // Force scenes if v2 api and scenes are enabled
  if (config.featureToggles.useV2DashboardsAPI && config.featureToggles.dashboardScene && !forceOld) {
    console.log('DashboardPageProxy: forcing scenes because of v2 api');
    return <DashboardScenePage {...props} />;
  }

  if (forceScenes || (config.featureToggles.dashboardScene && !forceOld)) {
    return <DashboardScenePage {...props} />;
  }

  const stateManager = getDashboardScenePageStateManager();
  const isScenesSupportedRoute = Boolean(
    props.route.routeName === DashboardRoutes.Home || (props.route.routeName === DashboardRoutes.Normal && params.uid)
  );

  // We pre-fetch dashboard to render dashboard page component depending on dashboard permissions.
  // To avoid querying single dashboard multiple times, stateManager.fetchDashboard uses a simple, short-lived cache.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const dashboard = useAsync(async () => {
    if (params.type === 'snapshot') {
      return null;
    }

    return stateManager.fetchDashboard({
      route: props.route.routeName as DashboardRoutes,
      uid: params.uid ?? '',
      type: params.type,
    });
  }, [params.uid, props.route.routeName]);

  if (dashboard.error) {
    return <DashboardPageProxyError error={dashboard.error} />;
  }

  if (dashboard.loading) {
    return null;
  }

  if (dashboard?.value?.dashboard?.uid !== params.uid && dashboard.value?.meta?.isNew !== true) {
    return null;
  }

  if (!config.featureToggles.dashboardSceneForViewers) {
    return <DashboardPage {...props} params={params} location={location} />;
  }

  if (
    dashboard.value &&
    !(dashboard.value.meta?.canEdit || dashboard.value.meta?.canMakeEditable) &&
    isScenesSupportedRoute
  ) {
    return <DashboardScenePage {...props} />;
  } else {
    return <DashboardPage {...props} params={params} location={location} />;
  }
}

export default DashboardPageProxy;

function DashboardPageProxyError({ error }: { error: Error }) {
  const status = getStatusFromError(error);
  const message = getMessageFromError(error);
  return (
    <Page navId="dashboards/browse" layout={PageLayoutType.Canvas} pageNav={{ text: 'Not found' }}>
      <Box paddingY={4} display="flex" direction="column" alignItems="center">
        {status === 404 ? (
          <EntityNotFound entity="Dashboard" />
        ) : (
          <Alert title="Dashboard failed to load" severity="error" data-testid="dashboard-not-found">
            {message}
          </Alert>
        )}
      </Box>
    </Page>
  );
}
