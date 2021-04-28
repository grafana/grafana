import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaThemeV2 } from '@grafana/data';
import { Alert, Field, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'react-redux';
import { Redirect } from 'react-router-dom';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AmRootRoute } from './components/amroutes/AmRootRoute';
import { AmSpecificRouting } from './components/amroutes/AmSpecificRouting';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction } from './state/actions';
import { AmRouteReceiver, FormAmRoute } from './types/amroutes';
import { amRouteToFormAmRoute, formAmRouteToAmRoute, stringsToSelectableValues } from './utils/amroutes';
import { initialAsyncRequestState } from './utils/redux';

const AmRoutes: FC = () => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const [isRootRouteEditMode, setIsRootRouteEditMode] = useState(false);

  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);

  const fetchConfig = useCallback(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const { result, loading, error } =
    (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;

  const config = result?.alertmanager_config;
  const routes = useMemo(() => amRouteToFormAmRoute(config?.route), [config?.route]);

  if (!alertManagerSourceName) {
    return <Redirect to="/alerting/routes" />;
  }

  const receivers = stringsToSelectableValues(
    (config?.receivers ?? []).map((receiver: Receiver) => receiver.name)
  ) as AmRouteReceiver[];

  const enterRootRouteEditMode = () => {
    setIsRootRouteEditMode(true);
  };

  const exitRootRouteEditMode = () => {
    setIsRootRouteEditMode(false);
  };

  const handleSave = (data: Partial<FormAmRoute>) => {
    const newData = formAmRouteToAmRoute({
      ...routes,
      ...data,
    });

    if (isRootRouteEditMode) {
      exitRootRouteEditMode();
    }

    console.log(newData);

    fetchConfig();
  };

  return (
    <AlertingPageWrapper pageId="am-routes">
      <Field label="Choose alert manager">
        <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      </Field>
      {error && !loading && (
        <Alert severity="error" title="Error loading alert manager config">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {loading && <LoadingPlaceholder text="loading alert manager config..." />}
      {result && !loading && !error && (
        <>
          <div className={styles.break} />
          <AmRootRoute
            isEditMode={isRootRouteEditMode}
            onSave={handleSave}
            onEnterEditMode={enterRootRouteEditMode}
            onExitEditMode={exitRootRouteEditMode}
            receivers={receivers}
            routes={routes}
          />
          <div className={styles.break} />
          <AmSpecificRouting
            onChange={handleSave}
            onRootRouteEdit={enterRootRouteEditMode}
            receivers={receivers}
            routes={routes}
          />
        </>
      )}
    </AlertingPageWrapper>
  );
};

export default AmRoutes;

const getStyles = (theme: GrafanaThemeV2) => ({
  break: css`
    width: 100%;
    height: 0;
    margin-bottom: ${theme.spacing(2)};
    border-bottom: solid 1px ${theme.colors.border.medium};
  `,
});
