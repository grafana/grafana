import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { usePrevious } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useSelector, useDispatch } from 'app/types';

import { GrafanaRouteComponentProps } from '../../../core/navigation/types';
import { DashNavTimeControls } from '../components/DashNav/DashNavTimeControls';
import { DashboardFailed } from '../components/DashboardLoading/DashboardFailed';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { PublicDashboardFooter } from '../components/PublicDashboardFooter/PublicDashboardsFooter';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { getTimeSrv } from '../services/TimeSrv';
import { initDashboard } from '../state/initDashboard';

import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from './DashboardPage';

export type Props = GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>;

const PublicDashboardPage = (props: Props) => {
  const { match, route, location } = props;
  const dispatch = useDispatch();
  const context = useGrafana();
  const prevProps = usePrevious(props);
  const styles = useStyles2(getStyles);
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel();

  useEffect(() => {
    dispatch(
      initDashboard({
        routeName: route.routeName,
        fixUrl: false,
        accessToken: match.params.accessToken,
        keybindingSrv: context.keybindings,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevProps?.location.search !== location.search) {
      const prevUrlParams = prevProps?.queryParams;
      const urlParams = props.queryParams;

      if (urlParams?.from !== prevUrlParams?.from || urlParams?.to !== prevUrlParams?.to) {
        getTimeSrv().updateTimeRangeFromUrl();
      }

      if (!prevUrlParams?.refresh && urlParams?.refresh) {
        getTimeSrv().setAutoRefresh(urlParams.refresh);
      }
    }
  }, [prevProps, location.search, props.queryParams]);

  if (!dashboard) {
    return <DashboardLoading initPhase={dashboardState.initPhase} />;
  }

  return (
    <div className={styles.container}>
      {dashboardState.initError && <DashboardFailed />}

      <div className={styles.header}>
        <h1 className={styles.title}>{dashboard.title}</h1>
        <PublicDashboardFooter />
        <div className={styles.headerRight}>
          <ToolbarButtonRow>
            {!dashboard.timepicker.hidden && <DashNavTimeControls dashboard={dashboard} onChangeTimeZone={() => {}} />}
          </ToolbarButtonRow>
        </div>
      </div>

      <DashboardGrid dashboard={dashboard} isEditable={false} viewPanel={null} editPanel={null} />
    </div>
  );
};

export default PublicDashboardPage;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    background: theme.colors.background.canvas,
    padding: theme.spacing(theme.components.dashboard.padding),
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  }),
  title: css({
    fontSize: theme.typography.h3.fontSize,
  }),
  header: css({
    display: 'flex',
    padding: theme.spacing(1, 2),
    gap: theme.spacing(2),
  }),
  headerRight: css({
    flexGrow: 1,
    display: 'flex',
    justifyContent: 'flex-end',
  }),
});
