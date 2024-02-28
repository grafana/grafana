import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import {
  PublicDashboardPageRouteParams,
  PublicDashboardPageRouteSearchParams,
} from 'app/features/dashboard/containers/types';

import { Page } from '../../../core/components/Page/Page';
import PageLoader from '../../../core/components/PageLoader/PageLoader';
import { DashboardRoutes } from '../../../types';
import { PublicDashboardFooter } from '../../dashboard/components/PublicDashboard/PublicDashboardsFooter';
import { DashboardScene } from '../scene/DashboardScene';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

export interface Props
  extends GrafanaRouteComponentProps<PublicDashboardPageRouteParams, PublicDashboardPageRouteSearchParams> {}

export function PublicDashboardScenePage({ match, route }: Props) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    stateManager.loadDashboard({ uid: match.params.accessToken!, route: DashboardRoutes.Public });

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, match.params.accessToken, route.routeName]);

  if (!dashboard) {
    return (
      <Page layout={PageLayoutType.Custom} data-testid={'public-dashboard-scene-page'}>
        {isLoading && <PageLoader />}
        {loadError && <h2>{loadError}</h2>}
      </Page>
    );
  }

  return <PublicDashboardSceneRenderer model={dashboard} />;
}

function PublicDashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.canvas}>
      <model.Component model={model} />
      <PublicDashboardFooter />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    canvas: css({
      label: 'canvas',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flexBasis: '100%',
      flexGrow: 1,
    }),
  };
}
