import React, { useEffect } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch, useSelector } from 'app/types';

import { DashboardFailed } from '../components/DashboardLoading/DashboardFailed';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { initDashboard } from '../state/initDashboard';

interface EmbeddedDashboardPageRouteParams {
  accessToken?: string;
  uid: string;
}

interface EmbeddedDashboardPageRouteSearchParams {
  from?: string;
  to?: string;
  refresh?: string;
}

export type Props = GrafanaRouteComponentProps<
  EmbeddedDashboardPageRouteParams,
  EmbeddedDashboardPageRouteSearchParams
>;

export default function EmbeddedDashboardPage({ match, route }: Props) {
  const dispatch = useDispatch();
  const context = useGrafana();
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel();

  useEffect(() => {
    dispatch(
      initDashboard({
        routeName: route.routeName,
        fixUrl: false,
        accessToken: match.params.accessToken,
        keybindingSrv: context.keybindings,
        urlUid: match.params.uid,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dashboard) {
    return <DashboardLoading initPhase={dashboardState.initPhase} />;
  }

  if (dashboard.meta.dashboardNotFound) {
    return <p>Not available</p>;
  }

  return (
    <Page pageNav={{ text: dashboard.title }} layout={PageLayoutType.Custom}>
      {dashboardState.initError && <DashboardFailed initError={dashboardState.initError} />}
      <div className={''}>
        <DashboardGrid dashboard={dashboard} isEditable={false} viewPanel={null} editPanel={null} hidePanelMenus />
      </div>
    </Page>
  );
}
