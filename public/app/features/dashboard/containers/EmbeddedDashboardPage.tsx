import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { PageLayoutType } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { Button, ModalsController, PageToolbar } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch, useSelector } from 'app/types';

import { updateTimeZoneForSession } from '../../profile/state/reducers';
import { DashNavTimeControls } from '../components/DashNav/DashNavTimeControls';
import { DashboardFailed } from '../components/DashboardLoading/DashboardFailed';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { SaveDashboardDrawer } from '../components/EmbeddedDashboard/SaveDashboardDrawer';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { DashboardModel } from '../state';
import { initDashboard } from '../state/initDashboard';

interface EmbeddedDashboardPageRouteParams {
  uid: string;
}

interface EmbeddedDashboardPageRouteSearchParams {
  callbackUrl?: string;
  json?: string;
  accessToken?: string;
}

export type Props = GrafanaRouteComponentProps<
  EmbeddedDashboardPageRouteParams,
  EmbeddedDashboardPageRouteSearchParams
>;

export default function EmbeddedDashboardPage({ route, queryParams }: Props) {
  const dispatch = useDispatch();
  const context = useGrafana();
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel();
  const [dashboardJson, setDashboardJson] = useState('');

  /**
   * Create dashboard model and initialize the dashboard from JSON
   */
  useEffect(() => {
    const callbackUrl = queryParams.callbackUrl;

    if (!callbackUrl) {
      throw new Error('No callback URL provided');
    }
    getBackendSrv()
      .get(`${callbackUrl}/load-dashboard`)
      .then((dashboardJson) => {
        setDashboardJson(dashboardJson);
        const dashboardModel = new DashboardModel(dashboardJson);

        dispatch(
          initDashboard({
            routeName: route.routeName,
            fixUrl: false,
            keybindingSrv: context.keybindings,
            dashboardDto: { dashboard: dashboardModel, meta: { canEdit: true } },
          })
        );
      })
      .catch((err) => {
        console.log('Error getting dashboard JSON: ', err);
      });
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
      <Toolbar dashboard={dashboard} callbackUrl={queryParams.callbackUrl} dashboardJson={dashboardJson} />
      {dashboardState.initError && <DashboardFailed initError={dashboardState.initError} />}
      <div className={''}>
        <DashboardGrid dashboard={dashboard} isEditable viewPanel={null} editPanel={null} hidePanelMenus />
      </div>
    </Page>
  );
}

interface ToolbarProps {
  dashboard: DashboardModel;
  callbackUrl?: string;
  dashboardJson: string;
}

const Toolbar = ({ dashboard, callbackUrl, dashboardJson }: ToolbarProps) => {
  const dispatch = useDispatch();

  const onChangeTimeZone = (timeZone: TimeZone) => {
    dispatch(updateTimeZoneForSession(timeZone));
  };

  const saveDashboard = async (clone: DashboardModel) => {
    if (!clone || !callbackUrl) {
      return;
    }

    return getBackendSrv().post(`${callbackUrl}/save-dashboard`, { dashboard: clone });
  };

  return (
    <PageToolbar
      title={dashboard.title}
      buttonOverflowAlignment="right"
      className={css`
        padding: 26px 16px;
      `}
    >
      {!dashboard.timepicker.hidden && (
        <DashNavTimeControls dashboard={dashboard} onChangeTimeZone={onChangeTimeZone} />
      )}
      <ModalsController key="button-save">
        {({ showModal, hideModal }) => (
          <Button
            onClick={() => {
              showModal(SaveDashboardDrawer, {
                dashboard,
                dashboardJson,
                onDismiss: hideModal,
                onSave: saveDashboard,
              });
            }}
          >
            Save
          </Button>
        )}
      </ModalsController>
    </PageToolbar>
  );
};
