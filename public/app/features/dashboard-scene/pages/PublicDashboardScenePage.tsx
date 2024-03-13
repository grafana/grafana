import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

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
  const [isActive, setIsActive] = useState(false);
  const { controls, title } = model.useState();
  const { timePicker, refreshPicker, hideTimeControls } = controls!.useState();
  const bodyToRender = model.getBodyToRender();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setIsActive(true);
    return model.activate();
  }, [model]);

  if (!isActive) {
    return null;
  }

  return (
    <Page layout={PageLayoutType.Custom} className={styles.page}>
      <div className={styles.controls}>
        <Stack alignItems="center">
          <div className={styles.iconTitle}>
            <Icon name="grafana" size="lg" aria-hidden />
          </div>
          <span className={styles.title}>{title}</span>
        </Stack>
        {!hideTimeControls && (
          <Stack>
            <timePicker.Component model={timePicker} />
            <refreshPicker.Component model={refreshPicker} />
          </Stack>
        )}
      </div>
      <div className={styles.body}>
        <bodyToRender.Component model={bodyToRender} />
      </div>
      <PublicDashboardFooter />
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    page: css({
      padding: theme.spacing(0, 2),
    }),
    controls: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: theme.zIndex.navbarFixed,
      background: theme.colors.background.canvas,
      padding: theme.spacing(2, 0),
      [theme.breakpoints.down('sm')]: {
        flexDirection: 'column',
        gap: theme.spacing(1),
        alignItems: 'stretch',
      },
    }),
    iconTitle: css({
      display: 'none',
      [theme.breakpoints.up('sm')]: {
        display: 'flex',
        alignItems: 'center',
      },
    }),
    title: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'flex',
      fontSize: theme.typography.h4.fontSize,
      margin: 0,
    }),
    body: css({
      label: 'body',
      marginBottom: theme.spacing(3),
    }),
  };
}
