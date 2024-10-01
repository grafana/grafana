// Libraries
import { css } from '@emotion/css';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Spinner, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageRouteParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { DashboardScene } from '../scene/DashboardScene';

import { useSoloPanel } from './useSoloPanel';

export interface Props extends GrafanaRouteComponentProps<DashboardPageRouteParams, { panelId: string }> {}

/**
 * Used for iframe embedding and image rendering of single panels
 */
export function SoloPanelPage({ match, queryParams }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard } = stateManager.useState();

  useEffect(() => {
    stateManager.loadDashboard({ uid: match.params.uid!, route: DashboardRoutes.Embedded });
    return () => stateManager.clearState();
  }, [stateManager, match, queryParams]);

  if (!queryParams.panelId) {
    return <EntityNotFound entity="Panel" />;
  }

  if (!dashboard) {
    return <PageLoader />;
  }

  return <SoloPanelRenderer dashboard={dashboard} panelId={queryParams.panelId} />;
}

export default SoloPanelPage;

export function SoloPanelRenderer({ dashboard, panelId }: { dashboard: DashboardScene; panelId: string }) {
  const [panel, error] = useSoloPanel(dashboard, panelId);
  const styles = useStyles2(getStyles);

  if (error) {
    return <Alert title={error} />;
  }

  if (!panel) {
    return (
      <span>
        Loading <Spinner />
      </span>
    );
  }

  return (
    <div className={styles.container}>
      <panel.Component model={panel} />
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
