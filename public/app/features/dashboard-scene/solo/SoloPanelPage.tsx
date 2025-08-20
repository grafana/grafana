// Libraries
import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Alert, Box, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types/dashboard';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { DashboardScene } from '../scene/DashboardScene';
import { SoloPanelContext, useDefineSoloPanelContext } from '../scene/SoloPanelContext';

export interface Props extends GrafanaRouteComponentProps<DashboardPageRouteParams, { panelId: string }> {}

/**
 * Used for iframe embedding and image rendering of single panels
 */
export function SoloPanelPage({ queryParams }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, loadError } = stateManager.useState();
  const { uid = '', type, slug } = useParams();

  useEffect(() => {
    stateManager.loadDashboard({ uid, type, slug, route: DashboardRoutes.Embedded });
    return () => stateManager.clearState();
  }, [stateManager, queryParams, uid, type, slug]);

  if (!queryParams.panelId) {
    return <EntityNotFound entity="Panel" />;
  }

  if (loadError) {
    return (
      <Box justifyContent={'center'} alignItems={'center'} display={'flex'} height={'100%'}>
        <Alert severity="error" title={t('dashboard.errors.failed-to-load', 'Failed to load dashboard')}>
          {loadError.message}
        </Alert>
      </Box>
    );
  }

  if (!dashboard) {
    return <PageLoader />;
  }

  return (
    <UrlSyncContextProvider scene={dashboard}>
      <SoloPanelRenderer dashboard={dashboard} panelId={queryParams.panelId} />
    </UrlSyncContextProvider>
  );
}

export default SoloPanelPage;

export function SoloPanelRenderer({ dashboard, panelId }: { dashboard: DashboardScene; panelId: string }) {
  const { controls, body } = dashboard.useState();
  const refreshPicker = controls?.useState()?.refreshPicker;
  const styles = useStyles2(getStyles);
  const soloPanelContext = useDefineSoloPanelContext(panelId);

  useEffect(() => {
    const dashDeactivate = dashboard.activate();
    const refreshDeactivate = refreshPicker?.activate();

    return () => {
      dashDeactivate();
      refreshDeactivate?.();
    };
  }, [dashboard, refreshPicker]);

  return (
    <div className={styles.container}>
      <SoloPanelContext.Provider value={soloPanelContext}>
        <body.Component model={body} />
      </SoloPanelContext.Provider>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'fixed',
    bottom: 0,
    right: 0,
    margin: 0,
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  }),
});
