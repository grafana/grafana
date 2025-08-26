import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneComponentProps, UrlSyncContextProvider } from '@grafana/scenes';
import { Alert, Box, Icon, Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { PublicDashboardFooter } from 'app/features/dashboard/components/PublicDashboard/PublicDashboardsFooter';
import { useGetPublicDashboardConfig } from 'app/features/dashboard/components/PublicDashboard/usePublicDashboardConfig';
import { PublicDashboardNotAvailable } from 'app/features/dashboard/components/PublicDashboardNotAvailable/PublicDashboardNotAvailable';
import {
  PublicDashboardPageRouteParams,
  PublicDashboardPageRouteSearchParams,
} from 'app/features/dashboard/containers/types';
import { AppNotificationSeverity } from 'app/types/appNotifications';
import { DashboardRoutes } from 'app/types/dashboard';

import { DashboardScene } from '../scene/DashboardScene';

import { getDashboardScenePageStateManager, LoadError } from './DashboardScenePageStateManager';

const selectors = e2eSelectors.pages.PublicDashboardScene;

export type Props = Omit<
  GrafanaRouteComponentProps<PublicDashboardPageRouteParams, PublicDashboardPageRouteSearchParams>,
  'match' | 'history'
>;

export function PublicDashboardScenePage({ route }: Props) {
  const { accessToken = '' } = useParams();
  const stateManager = getDashboardScenePageStateManager();
  const styles = useStyles2(getStyles);
  const { dashboard, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    stateManager.loadDashboard({ uid: accessToken, route: DashboardRoutes.Public });

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, accessToken, route.routeName]);

  if (loadError) {
    return <PublicDashboardScenePageError error={loadError} />;
  }

  if (!dashboard) {
    return (
      <Page layout={PageLayoutType.Custom} className={styles.loadingPage} data-testid={selectors.loadingPage}>
        {isLoading && <PageLoader />}
      </Page>
    );
  }

  // if no time picker render without url sync
  if (dashboard.state.controls?.state.hideTimeControls) {
    return <PublicDashboardSceneRenderer model={dashboard} />;
  }

  return (
    <UrlSyncContextProvider scene={dashboard}>
      <PublicDashboardSceneRenderer model={dashboard} />
    </UrlSyncContextProvider>
  );
}

function PublicDashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const [isActive, setIsActive] = useState(false);
  const { controls, title, body } = model.useState();
  const { timePicker, refreshPicker, hideTimeControls } = controls!.useState();
  const styles = useStyles2(getStyles);
  const conf = useGetPublicDashboardConfig();

  useEffect(() => {
    return refreshPicker.activate();
  }, [refreshPicker]);

  useEffect(() => {
    setIsActive(true);
    return model.activate();
  }, [model]);

  if (!isActive) {
    return null;
  }

  return (
    <Page layout={PageLayoutType.Custom} className={styles.page} data-testid={selectors.page}>
      <div className={styles.controls}>
        <Stack alignItems="center">
          {!conf.headerLogoHide && (
            <div className={styles.iconTitle}>
              <Icon name="grafana" size="lg" aria-hidden />
            </div>
          )}
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
        <body.Component model={body} />
      </div>
      <PublicDashboardFooter />
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    loadingPage: css({
      justifyContent: 'center',
    }),
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
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      overflowY: 'auto',
    }),
  };
}

function PublicDashboardScenePageError({ error }: { error: LoadError }) {
  const styles = useStyles2(getStyles);
  const statusCode = error.status;
  const messageId = error.messageId;
  const message = error.message;

  const isPublicDashboardPaused = statusCode === 403 && messageId === 'publicdashboards.notEnabled';
  const isPublicDashboardNotFound = statusCode === 404 && messageId === 'publicdashboards.notFound';
  const isDashboardNotFound = statusCode === 404 && messageId === 'publicdashboards.dashboardNotFound';

  const publicDashboardEnabled = isPublicDashboardNotFound ? undefined : !isPublicDashboardPaused;
  const dashboardNotFound = isPublicDashboardNotFound || isDashboardNotFound;

  if (publicDashboardEnabled === false) {
    return <PublicDashboardNotAvailable paused />;
  }

  if (dashboardNotFound) {
    return <PublicDashboardNotAvailable />;
  }

  return (
    <Page layout={PageLayoutType.Custom} className={styles.loadingPage} data-testid={selectors.loadingPage}>
      <Box paddingY={4} display="flex" direction="column" alignItems="center">
        <Alert severity={AppNotificationSeverity.Error} title={message}>
          {message}
        </Alert>
      </Box>
    </Page>
  );
}
