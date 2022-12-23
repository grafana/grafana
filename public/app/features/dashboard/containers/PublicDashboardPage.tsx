import React, { useEffect } from 'react';
import { usePrevious } from 'react-use';

import { PageLayoutType, TimeZone } from '@grafana/data';
import { PageToolbar, ToolbarButtonRow } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { useSelector, useDispatch } from 'app/types';

import { DashNavTimeControls } from '../components/DashNav/DashNavTimeControls';
import { DashboardFailed } from '../components/DashboardLoading/DashboardFailed';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { PublicDashboardFooter } from '../components/PublicDashboardFooter/PublicDashboardsFooter';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { getTimeSrv } from '../services/TimeSrv';
import { DashboardModel } from '../state';
import { initDashboard } from '../state/initDashboard';

import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from './DashboardPage';

export type Props = GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>;

const Toolbar = ({ dashboard }: { dashboard: DashboardModel }) => {
  const dispatch = useDispatch();

  const onChangeTimeZone = (timeZone: TimeZone) => {
    dispatch(updateTimeZoneForSession(timeZone));
  };

  return (
    <PageToolbar title={dashboard.title}>
      <ToolbarButtonRow alignment="right">
        {!dashboard.timepicker.hidden && (
          <DashNavTimeControls dashboard={dashboard} onChangeTimeZone={onChangeTimeZone} />
        )}
      </ToolbarButtonRow>
    </PageToolbar>
  );
};

const PublicDashboardPage = (props: Props) => {
  const { match, route, location } = props;
  const dispatch = useDispatch();
  const context = useGrafana();
  const prevProps = usePrevious(props);
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
    <>
      <Page layout={PageLayoutType.Canvas} toolbar={<Toolbar dashboard={dashboard} />}>
        {dashboardState.initError && <DashboardFailed />}
        <DashboardGrid dashboard={dashboard} isEditable={false} viewPanel={null} editPanel={null} />
      </Page>
      <PublicDashboardFooter />
    </>
  );
};

export default PublicDashboardPage;
