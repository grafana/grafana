import React, { useEffect } from 'react';
import { Route, RouteChildrenProps, Switch, useLocation } from 'react-router-dom';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { fetchAlertManagerConfigAction, fetchGrafanaNotifiersAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
import { GrafanaAlertmanagerDeliveryWarning } from '../GrafanaAlertmanagerDeliveryWarning';
import { DuplicateTemplateView } from '../receivers/DuplicateTemplateView';
import { EditReceiverView } from '../receivers/EditReceiverView';
import { EditTemplateView } from '../receivers/EditTemplateView';
import { GlobalConfigForm } from '../receivers/GlobalConfigForm';
import { NewReceiverView } from '../receivers/NewReceiverView';
import { NewTemplateView } from '../receivers/NewTemplateView';
import { ReceiversAndTemplatesView } from '../receivers/ReceiversAndTemplatesView';

export interface NotificationErrorProps {
  errorCount: number;
}

const Receivers = () => {
  const { selectedAlertmanager: alertManagerSourceName } = useAlertmanager();
  const dispatch = useDispatch();

  const location = useLocation();
  const isRoot = location.pathname.endsWith('/alerting/notifications');
  const configRequests = useUnifiedAlertingSelector((state) => state.amConfigs);

  const {
    result: config,
    loading,
    error,
  } = (alertManagerSourceName && configRequests[alertManagerSourceName]) || initialAsyncRequestState;

  const receiverTypes = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);

  const shouldLoadConfig = isRoot || !config;
  // const shouldRenderNotificationStatus = isRoot;

  useEffect(() => {
    if (alertManagerSourceName && shouldLoadConfig) {
      dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch, shouldLoadConfig]);

  useEffect(() => {
    if (
      alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME &&
      !(receiverTypes.result || receiverTypes.loading || receiverTypes.error)
    ) {
      dispatch(fetchGrafanaNotifiersAction());
    }
  }, [alertManagerSourceName, dispatch, receiverTypes]);

  if (!alertManagerSourceName) {
    return null;
  }

  return (
    <>
      {error && !loading && (
        <Alert severity="error" title="Error loading Alertmanager config">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={alertManagerSourceName} />
      {loading && !config && <LoadingPlaceholder text="loading configuration..." />}
      {config && !error && (
        <Switch>
          <Route exact={true} path="/alerting/notifications">
            <ReceiversAndTemplatesView config={config} alertManagerName={alertManagerSourceName} />
          </Route>
          <Route exact={true} path="/alerting/notifications/templates/new">
            <NewTemplateView config={config} alertManagerSourceName={alertManagerSourceName} />
          </Route>
          <Route exact={true} path="/alerting/notifications/templates/:name/duplicate">
            {({ match }: RouteChildrenProps<{ name: string }>) =>
              match?.params.name && (
                <DuplicateTemplateView
                  alertManagerSourceName={alertManagerSourceName}
                  config={config}
                  templateName={decodeURIComponent(match?.params.name)}
                />
              )
            }
          </Route>
          <Route exact={true} path="/alerting/notifications/templates/:name/edit">
            {({ match }: RouteChildrenProps<{ name: string }>) =>
              match?.params.name && (
                <EditTemplateView
                  alertManagerSourceName={alertManagerSourceName}
                  config={config}
                  templateName={decodeURIComponent(match?.params.name)}
                />
              )
            }
          </Route>
          <Route exact={true} path="/alerting/notifications/receivers/new">
            <NewReceiverView config={config} alertManagerSourceName={alertManagerSourceName} />
          </Route>
          <Route exact={true} path="/alerting/notifications/receivers/:name/edit">
            {({ match }: RouteChildrenProps<{ name: string }>) =>
              match?.params.name && (
                <EditReceiverView
                  alertManagerSourceName={alertManagerSourceName}
                  config={config}
                  receiverName={decodeURIComponent(match?.params.name)}
                />
              )
            }
          </Route>
          <Route exact={true} path="/alerting/notifications/global-config">
            <GlobalConfigForm config={config} alertManagerSourceName={alertManagerSourceName} />
          </Route>
        </Switch>
      )}
    </>
  );
};

export default Receivers;
