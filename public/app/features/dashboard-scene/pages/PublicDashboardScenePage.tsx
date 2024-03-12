import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Icon, Stack, useStyles2 } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import {
  PublicDashboardPageRouteParams,
  PublicDashboardPageRouteSearchParams,
} from 'app/features/dashboard/containers/types';

import { Page } from '../../../core/components/Page/Page';
import PageLoader from '../../../core/components/PageLoader/PageLoader';
import { DashboardRoutes } from '../../../types';
import { PublicDashboardFooter } from '../../dashboard/components/PublicDashboard/PublicDashboardsFooter';
import { PublicDashboardNotAvailable } from '../../dashboard/components/PublicDashboardNotAvailable/PublicDashboardNotAvailable';
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

  if (dashboard.state.meta.publicDashboardEnabled === false) {
    return <PublicDashboardNotAvailable paused />;
  }

  if (dashboard.state.meta.dashboardNotFound) {
    return <PublicDashboardNotAvailable />;
  }

  return <PublicDashboardSceneRenderer model={dashboard} />;
}

function PublicDashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { controls, title } = model.useState();
  const { timePicker, refreshPicker, hideTimeControls } = controls!.useState();
  const bodyToRender = model.getBodyToRender();
  const styles = useStyles2(getStyles);

  return (
    // <div className={styles.canvas}>
    //   <model.Component model={model} />
    // <div className={styles.canvas}>
    <Page layout={PageLayoutType.Canvas}>
      <Stack justifyContent={'space-between'}>
        <Stack alignItems="center">
          <div className={styles.pageIcon}>
            <Icon name="grafana" size="lg" aria-hidden />
          </div>
          <span className={styles.truncateText}>{title}</span>
        </Stack>
        {!hideTimeControls && (
          <Stack>
            <timePicker.Component model={timePicker} />
            <refreshPicker.Component model={refreshPicker} />
          </Stack>
        )}
      </Stack>
      <div className={styles.body}>
        <bodyToRender.Component model={bodyToRender} />
      </div>
      <PublicDashboardFooter />
    </Page>
    //{' '}
    // </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    titleContainer: css({
      display: 'flex',
    }),
    pageIcon: css({
      display: 'none',
      [theme.breakpoints.up('sm')]: {
        display: 'flex',
        alignItems: 'center',
      },
    }),
    truncateText: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'flex',
      fontSize: theme.typography.size.lg,
      margin: 0,
    }),
    canvas: css({
      label: 'canvas',
      display: 'flex',
      flexDirection: 'column',
      flexBasis: '100%',
      flexGrow: 1,
      padding: theme.spacing(2),
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      gap: '8px',
      marginTop: theme.spacing(3),
      marginBottom: theme.spacing(2),
    }),
  };
}
