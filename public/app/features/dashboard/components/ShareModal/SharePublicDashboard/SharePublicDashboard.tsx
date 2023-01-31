import React, { useEffect } from 'react';
import { Subscription } from 'rxjs';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import { Alert, Spinner, useForceUpdate } from '@grafana/ui/src';
import { useGetPublicDashboardQuery } from 'app/features/dashboard/api/publicDashboardApi';
import {
  dashboardHasTemplateVariables,
  getUnsupportedDashboardDatasources,
  publicDashboardPersisted,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { ShareModalTabProps } from 'app/features/dashboard/components/ShareModal/types';

import { DashboardMetaChangedEvent } from '../../../../../types/events';

import ConfigPublicDashboard from './ConfigPublicDashboard/ConfigPublicDashboard';
import CreatePublicDashboard from './CreatePublicDashboard/CreatePublicDashboard';
interface Props extends ShareModalTabProps {}

export const SharePublicDashboard = (props: Props) => {
  const forceUpdate = useForceUpdate();
  const dashboardVariables = props.dashboard.getVariables();
  const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

  const {
    isLoading: isGetLoading,
    data: publicDashboard,
    // isError: isGetError,
    isFetching,
  } = useGetPublicDashboardQuery(props.dashboard.uid);

  useEffect(() => {
    const eventSubs = new Subscription();
    eventSubs.add(props.dashboard.events.subscribe(DashboardMetaChangedEvent, forceUpdate));
    reportInteraction('grafana_dashboards_public_share_viewed');

    return () => eventSubs.unsubscribe();
  }, [props.dashboard.events, forceUpdate]);

  return (
    <>
      {(isGetLoading || isFetching) && <Spinner />}
      <div>
        {!!getUnsupportedDashboardDatasources(props.dashboard.panels).length && (
          <Alert
            severity="warning"
            title="Unsupported Datasources"
            data-testid={selectors.UnsupportedDatasourcesWarningAlert}
          >
            <div>
              {`There are datasources in this dashboard that are unsupported for public dashboards. Panels that use these datasources may not function properly: ${getUnsupportedDashboardDatasources(
                props.dashboard.panels
              ).join(', ')}. See the `}
              <a href="https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/" className="text-link">
                docs
              </a>{' '}
              for supported datasources.
            </div>
          </Alert>
        )}
        {dashboardHasTemplateVariables(dashboardVariables) && !publicDashboardPersisted(publicDashboard) ? (
          <Alert
            severity="warning"
            title="dashboard cannot be public"
            data-testid={selectors.TemplateVariablesWarningAlert}
          >
            This dashboard cannot be made public because it has template variables
          </Alert>
        ) : !publicDashboardPersisted(publicDashboard) ? (
          <CreatePublicDashboard dashboard={props.dashboard} />
        ) : (
          <ConfigPublicDashboard dashboard={props.dashboard} publicDashboard={publicDashboard!} />
        )}
      </div>
    </>
  );
};
