import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useEffect } from 'react';
import { Redirect, Route, RouteChildrenProps, Switch, useLocation, useParams } from 'react-router-dom';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, LoadingPlaceholder, withErrorBoundary, useStyles2, Icon } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { ContactPointsState } from '../../../types';

import { alertmanagerApi } from './api/alertmanagerApi';
import { useGetContactPointsState } from './api/receiversApi';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
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
import { fetchAlertManagerConfigAction, fetchGrafanaNotifiersAction } from './state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { initialAsyncRequestState } from './utils/redux';

export interface NotificationErrorProps {
  errorCount: number;
}

function NotificationError({ errorCount }: NotificationErrorProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.warning} data-testid="receivers-notification-error">
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
}

type PageType = 'receivers' | 'templates' | 'global-config';

const Receivers = () => {
  const { useGetAlertmanagerChoiceQuery } = alertmanagerApi;

  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName(alertManagers);
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const { id, type } = useParams<{ id?: string; type?: PageType }>();
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

  const { data: alertmanagerChoice } = useGetAlertmanagerChoiceQuery();

  const disableAmSelect = !isRoot;

  let pageNav = getPageNavigationModel(type, id);

  if (!alertManagerSourceName) {
    return isRoot ? (
      <AlertingPageWrapper pageId="receivers" pageNav={pageNav}>
        <NoAlertManagerWarning availableAlertManagers={alertManagers} />
      </AlertingPageWrapper>
    ) : (
      <Redirect to="/alerting/notifications" />
    );
  }

  return (
    <AlertingPageWrapper pageId="receivers" pageNav={pageNav}>
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
      <GrafanaAlertmanagerDeliveryWarning
        alertmanagerChoice={alertmanagerChoice}
        currentAlertmanager={alertManagerSourceName}
      />
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

function getPageNavigationModel(type: PageType | undefined, id: string | undefined) {
  let pageNav: NavModelItem | undefined;
  if (type === 'receivers' || type === 'templates') {
    const objectText = type === 'receivers' ? 'contact point' : 'message template';
    if (id) {
      pageNav = {
        text: id,
        subTitle: `Edit the settings for a specific ${objectText}`,
      };
    } else {
      pageNav = {
        text: `New ${objectText}`,
        subTitle: `Create a new ${objectText} for your notifications`,
      };
    }
  } else if (type === 'global-config') {
    pageNav = {
      text: 'Global config',
      subTitle: 'Manage your global configuration',
    };
  }
  return pageNav;
}

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
