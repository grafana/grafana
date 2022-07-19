import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Redirect, Route, RouteChildrenProps, Switch, useLocation } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, LoadingPlaceholder, withErrorBoundary, useStyles2, Icon } from '@grafana/ui';

import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { NoAlertManagerWarning } from './components/NoAlertManagerWarning';
import { EditReceiverView } from './components/receivers/EditReceiverView';
import { EditTemplateView } from './components/receivers/EditTemplateView';
import { GlobalConfigForm } from './components/receivers/GlobalConfigForm';
import { NewReceiverView } from './components/receivers/NewReceiverView';
import { NewTemplateView } from './components/receivers/NewTemplateView';
import { ReceiversAndTemplatesView } from './components/receivers/ReceiversAndTemplatesView';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from './hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import {
  fetchAlertManagerConfigAction,
  fetchContactPointsStateAction,
  fetchGrafanaNotifiersAction,
} from './state/actions';
import { CONTACT_POINTS_STATE_INTERVAL_MS } from './utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { initialAsyncRequestState } from './utils/redux';

export interface NotificationErrorProps {
  errorCount: number;
}

const NotificationError: FC<NotificationErrorProps> = ({ errorCount }: NotificationErrorProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.warning}>
      <Stack alignItems="flex-end" direction="column">
        <Stack alignItems="center">
          <Icon name="exclamation-triangle" />
          <div className={styles.countMessage}>
            {`${errorCount} ${pluralize('error', errorCount)} with contact points`}
          </div>
        </Stack>
        <div>{'Some alert notifications might not be delivered'}</div>
      </Stack>
    </div>
  );
};

const Receivers: FC = () => {
  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName(alertManagers);
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const location = useLocation();
  const isRoot = location.pathname.endsWith('/alerting/notifications');

  const configRequests = useUnifiedAlertingSelector((state) => state.amConfigs);
  const contactPointsStateRequest = useUnifiedAlertingSelector((state) => state.contactPointsState);

  const {
    result: config,
    loading,
    error,
  } = (alertManagerSourceName && configRequests[alertManagerSourceName]) || initialAsyncRequestState;

  const { result: contactPointsState } =
    (alertManagerSourceName && contactPointsStateRequest) || initialAsyncRequestState;

  const receiverTypes = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);

  const shouldLoadConfig = isRoot || !config;

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

  useEffect(() => {
    function fetchContactPointStates() {
      alertManagerSourceName && dispatch(fetchContactPointsStateAction(alertManagerSourceName));
    }
    fetchContactPointStates();
    const interval = setInterval(fetchContactPointStates, CONTACT_POINTS_STATE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [alertManagerSourceName, dispatch]);

  const integrationsErrorCount = contactPointsState?.errorCount ?? 0;

  const disableAmSelect = !isRoot;

  if (!alertManagerSourceName) {
    return isRoot ? (
      <AlertingPageWrapper pageId="receivers">
        <NoAlertManagerWarning availableAlertManagers={alertManagers} />
      </AlertingPageWrapper>
    ) : (
      <Redirect to="/alerting/notifications" />
    );
  }

  return (
    <AlertingPageWrapper pageId="receivers">
      <div className={styles.headingContainer}>
        <AlertManagerPicker
          current={alertManagerSourceName}
          disabled={disableAmSelect}
          onChange={setAlertManagerSourceName}
          dataSources={alertManagers}
        />
        {integrationsErrorCount > 0 && <NotificationError errorCount={integrationsErrorCount} />}
      </div>
      {error && !loading && (
        <Alert severity="error" title="Error loading Alertmanager config">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {loading && !config && <LoadingPlaceholder text="loading configuration..." />}
      {config && !error && (
        <Switch>
          <Route exact={true} path="/alerting/notifications">
            <ReceiversAndTemplatesView config={config} alertManagerName={alertManagerSourceName} />
          </Route>
          <Route exact={true} path="/alerting/notifications/templates/new">
            <NewTemplateView config={config} alertManagerSourceName={alertManagerSourceName} />
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
    </AlertingPageWrapper>
  );
};

export default withErrorBoundary(Receivers, { style: 'page' });

const getStyles = (theme: GrafanaTheme2) => ({
  warning: css`
    color: ${theme.colors.warning.text};
  `,
  countMessage: css`
    padding-left: 10px;
  `,
  headingContainer: css`
    display: flex;
    justify-content: space-between;
  `,
});
