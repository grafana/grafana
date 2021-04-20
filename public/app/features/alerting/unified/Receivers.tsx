import { Field, Alert, LoadingPlaceholder } from '@grafana/ui';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Redirect, Route, RouteChildrenProps, Switch, useLocation } from 'react-router-dom';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { EditTemplateView } from './components/receivers/EditTemplateView';
import { NewTemplateView } from './components/receivers/NewTemplateView';
import { ReceiversAndTemplatesView } from './components/receivers/ReceiversAndTemplatesView';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction, fetchGrafanaNotifiersAction } from './state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { initialAsyncRequestState } from './utils/redux';

const Receivers: FC = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();

  const location = useLocation();

  const config = useUnifiedAlertingSelector((state) => state.amConfigs);
  const receiverTypes = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);

  useEffect(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  useEffect(() => {
    if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME && !(receiverTypes.result || receiverTypes.loading)) {
      dispatch(fetchGrafanaNotifiersAction());
    }
  }, [alertManagerSourceName, dispatch, receiverTypes]);

  const { result, loading, error } =
    (alertManagerSourceName && config[alertManagerSourceName]) || initialAsyncRequestState;

  const disableAmSelect = !location.pathname.endsWith('/alerting/notifications');

  if (!alertManagerSourceName) {
    return <Redirect to="/alerting/notifications" />;
  }

  return (
    <AlertingPageWrapper pageId="receivers">
      <Field label={disableAmSelect ? 'Alert manager' : 'Choose alert manager'} disabled={disableAmSelect}>
        <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      </Field>
      {error && !loading && (
        <Alert severity="error" title="Error loading alert manager config">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {loading && <LoadingPlaceholder text="loading receivers..." />}
      {result && !loading && !error && (
        <Switch>
          <Route exact={true} path="/alerting/notifications">
            <ReceiversAndTemplatesView config={result} alertManagerName={alertManagerSourceName} />
          </Route>
          <Route exact={true} path="/alerting/notifications/templates/new">
            <NewTemplateView />
          </Route>
          <Route exact={true} path="/alerting/notifications/templates/:name/edit">
            {({ match }: RouteChildrenProps<{ name: string }>) =>
              match?.params.name && <EditTemplateView templateName={decodeURIComponent(match?.params.name)} />
            }
          </Route>
        </Switch>
      )}
    </AlertingPageWrapper>
  );
};

export default Receivers;
