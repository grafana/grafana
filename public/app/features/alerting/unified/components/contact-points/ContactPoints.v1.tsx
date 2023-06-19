import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useEffect } from 'react';
import { Redirect, Route, RouteChildrenProps, Switch, useLocation } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Icon, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { ContactPointsState, useDispatch } from 'app/types';

import { useGetContactPointsState } from '../../api/receiversApi';
import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from '../../hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction, fetchGrafanaNotifiersAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
import { AlertManagerPicker } from '../AlertManagerPicker';
import { GrafanaAlertmanagerDeliveryWarning } from '../GrafanaAlertmanagerDeliveryWarning';
import { NoAlertManagerWarning } from '../NoAlertManagerWarning';
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

function NotificationError({ errorCount }: NotificationErrorProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.error} data-testid="receivers-notification-error">
      <Stack alignItems="flex-end" direction="column" gap={0}>
        <Stack alignItems="center" gap={1}>
          <Icon name="exclamation-circle" />
          <div>{`${errorCount} ${pluralize('error', errorCount)} with contact points`}</div>
        </Stack>
        <div>{'Some alert notifications might not be delivered'}</div>
      </Stack>
    </div>
  );
}

const Receivers = () => {
  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName(alertManagers);
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

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
  const shouldRenderNotificationStatus = isRoot;

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

  const contactPointsState: ContactPointsState = useGetContactPointsState(alertManagerSourceName ?? '');
  const integrationsErrorCount = contactPointsState?.errorCount ?? 0;

  const disableAmSelect = !isRoot;

  if (!alertManagerSourceName) {
    return isRoot ? (
      <NoAlertManagerWarning availableAlertManagers={alertManagers} />
    ) : (
      <Redirect to="/alerting/notifications" />
    );
  }

  return (
    <>
      <div className={styles.headingContainer}>
        <AlertManagerPicker
          current={alertManagerSourceName}
          disabled={disableAmSelect}
          onChange={setAlertManagerSourceName}
          dataSources={alertManagers}
        />
        {shouldRenderNotificationStatus && integrationsErrorCount > 0 && (
          <NotificationError errorCount={integrationsErrorCount} />
        )}
      </div>
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

const getStyles = (theme: GrafanaTheme2) => ({
  error: css`
    color: ${theme.colors.error.text};
  `,
  headingContainer: css`
    display: flex;
    justify-content: space-between;
  `,
});
