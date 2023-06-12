import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useEffect } from 'react';
import { Redirect, Route, RouteChildrenProps, Switch, useLocation, useParams } from 'react-router-dom';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Icon, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { ContactPointsState } from '../../../types';

import { useGetContactPointsState } from './api/receiversApi';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import { NoAlertManagerWarning } from './components/NoAlertManagerWarning';
import { DuplicateTemplateView } from './components/receivers/DuplicateTemplateView';
import { EditReceiverView } from './components/receivers/EditReceiverView';
import { EditTemplateView } from './components/receivers/EditTemplateView';
import { GlobalConfigForm } from './components/receivers/GlobalConfigForm';
import { NewReceiverView } from './components/receivers/NewReceiverView';
import { NewTemplateView } from './components/receivers/NewTemplateView';
import { ReceiversAndTemplatesView } from './components/receivers/ReceiversAndTemplatesView';
import { isDuplicating } from './components/receivers/TemplateForm';
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

type PageType = 'receivers' | 'templates' | 'global-config';

const Receivers = () => {
  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName(alertManagers);
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const { id, type } = useParams<{ id?: string; type?: PageType }>();
  const location = useLocation();
  const isRoot = location.pathname.endsWith('/alerting/notifications');
  const isduplicatingTemplate = isDuplicating(location);
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
  let pageNav = getPageNavigationModel(type, id ? decodeURIComponent(id) : undefined, isduplicatingTemplate);

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
    </AlertingPageWrapper>
  );
};

function getPageNavigationModel(type: PageType | undefined, id: string | undefined, isDuplicatingTemplates: boolean) {
  let pageNav: NavModelItem | undefined;
  if (isDuplicatingTemplates) {
    return {
      text: `New template`,
      subTitle: `Create a new template for your notifications`,
    };
  }
  if (type === 'receivers' || type === 'templates') {
    const objectText = type === 'receivers' ? 'contact point' : 'notification template';
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
  error: css`
    color: ${theme.colors.error.text};
  `,
  headingContainer: css`
    display: flex;
    justify-content: space-between;
  `,
});
