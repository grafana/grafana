import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';
import { usePrevious } from 'react-use';

import { GrafanaTheme2, PageLayoutType, TimeZone } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { PageToolbar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import {
  PublicDashboardPageRouteParams,
  PublicDashboardPageRouteSearchParams,
} from 'app/features/dashboard/containers/types';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { useSelector, useDispatch, DashboardInitError } from 'app/types';

import { DashNavTimeControls } from '../components/DashNav/DashNavTimeControls';
import { DashboardFailed } from '../components/DashboardLoading/DashboardFailed';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { PublicDashboardFooter } from '../components/PublicDashboard/PublicDashboardsFooter';
import { useGetPublicDashboardConfig } from '../components/PublicDashboard/usePublicDashboardConfig';
import { PublicDashboardNotAvailable } from '../components/PublicDashboardNotAvailable/PublicDashboardNotAvailable';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { getTimeSrv } from '../services/TimeSrv';
import { DashboardModel } from '../state/DashboardModel';
import { initDashboard } from '../state/initDashboard';

export type Props = Omit<
  GrafanaRouteComponentProps<PublicDashboardPageRouteParams, PublicDashboardPageRouteSearchParams>,
  'match' | 'history'
>;

const selectors = e2eSelectors.pages.PublicDashboard;

const Toolbar = ({ dashboard }: { dashboard: DashboardModel }) => {
  const dispatch = useDispatch();
  const conf = useGetPublicDashboardConfig();

  const onChangeTimeZone = (timeZone: TimeZone) => {
    dispatch(updateTimeZoneForSession(timeZone));
  };

  return (
    <PageToolbar
      title={dashboard.title}
      pageIcon={!conf.headerLogoHide ? 'grafana' : undefined}
      buttonOverflowAlignment="right"
    >
      {!dashboard.timepicker.hidden && (
        <DashNavTimeControls dashboard={dashboard} onChangeTimeZone={onChangeTimeZone} />
      )}
    </PageToolbar>
  );
};

const PublicDashboardPage = (props: Props) => {
  const { route } = props;
  const location = useLocation();
  const { accessToken } = useParams();
  const dispatch = useDispatch();
  const context = useGrafana();
  const prevProps = usePrevious({ ...props, location });
  const styles = useStyles2(getStyles);
  const dashboardState = useSelector((store) => store.dashboard);
  const loadError = dashboardState.initError;
  const dashboard = dashboardState.getModel();

  useEffect(() => {
    dispatch(
      initDashboard({
        routeName: route.routeName,
        fixUrl: false,
        accessToken,
        keybindingSrv: context.keybindings,
      })
    );
  }, [route.routeName, accessToken, context.keybindings, dispatch]);

  useEffect(() => {
    if (prevProps?.location.search !== location.search) {
      const prevUrlParams = prevProps?.queryParams;
      const urlParams = props.queryParams;

      const updateTimeRangeFromUrl =
        (urlParams?.from !== prevUrlParams?.from || urlParams?.to !== prevUrlParams?.to) &&
        !dashboard?.timepicker.hidden;

      if (updateTimeRangeFromUrl) {
        getTimeSrv().updateTimeRangeFromUrl();
      }

      if (!prevUrlParams?.refresh && urlParams?.refresh) {
        getTimeSrv().setAutoRefresh(urlParams.refresh);
      }
    }
  }, [prevProps, location.search, props.queryParams, dashboard?.timepicker.hidden, accessToken]);

  if (loadError) {
    return <PublicDashboardPageError error={loadError} />;
  }

  if (!dashboard) {
    return <DashboardLoading initPhase={dashboardState.initPhase} />;
  }

  return (
    <Page pageNav={{ text: dashboard.title }} layout={PageLayoutType.Custom} data-testid={selectors.page}>
      <Toolbar dashboard={dashboard} />
      {dashboardState.initError && <DashboardFailed initError={dashboardState.initError} />}
      <div className={styles.gridContainer}>
        <DashboardGrid dashboard={dashboard} isEditable={false} viewPanel={null} editPanel={null} hidePanelMenus />
      </div>
      <div className={styles.footer}>
        <PublicDashboardFooter />
      </div>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  gridContainer: css({
    flex: 1,
    padding: theme.spacing(2, 2, 2, 2),
    overflow: 'auto',
  }),
  footer: css({
    padding: theme.spacing(0, 2),
  }),
});

export default PublicDashboardPage;

function PublicDashboardPageError({ error }: { error: DashboardInitError }) {
  let statusCode: number | undefined;
  let messageId: string | undefined;

  if (typeof error.error === 'object' && error.error !== null && 'data' in error.error) {
    const typedError = error.error as { data: { statusCode: number; messageId: string } };
    statusCode = typedError.data.statusCode;
    messageId = typedError.data.messageId;
  }

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

  return <DashboardFailed initError={error} />;
}
