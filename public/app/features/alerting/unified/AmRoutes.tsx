import React, { FC, useEffect, useMemo } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Alert, Field, LoadingPlaceholder, useStyles } from '@grafana/ui';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AmRootRoute } from './components/amroutes/AmRootRoute';
import { AmSpecificRouting } from './components/amroutes/AmSpecificRouting';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction } from './state/actions';
import { computeAlertManagerConfig, computeDefaultValuesRoute, mapObjectsToSelectableValue } from './utils/amroutes';
import { initialAsyncRequestState } from './utils/redux';

const AmRoutes: FC = () => {
  const dispatch = useDispatch();
  const styles = useStyles(getStyles);

  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);

  useEffect(() => {
    dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
  }, [alertManagerSourceName, dispatch]);

  const { result, loading, error } = amConfigs[alertManagerSourceName] || initialAsyncRequestState;

  const config = result?.alertmanager_config;
  const routes = useMemo(() => computeDefaultValuesRoute(config?.route), [config?.route]);
  const receivers = mapObjectsToSelectableValue(config?.receivers, 'name');

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
            onSave={(data) => {
              const newData = computeAlertManagerConfig({
                ...routes,
                ...data,
              });

              console.log(newData);
            }}
            receivers={receivers}
            routes={routes}
          />
          <div className={styles.break} />
          <AmSpecificRouting
            onChange={(data) => {
              const newData = computeAlertManagerConfig({
                ...routes,
                ...data,
              });

              console.log(newData);
            }}
            receivers={receivers}
            routes={routes}
          />
        </>
      )}
    </AlertingPageWrapper>
  );
};

export default AmRoutes;

const getStyles = (theme: GrafanaTheme) => ({
  iconError: css`
    color: ${theme.palette.red};
    margin-right: ${theme.spacing.md};
  `,
  break: css`
    width: 100%;
    height: 0;
    margin-bottom: ${theme.spacing.md};
    border-bottom: solid 1px ${theme.colors.border2};
  `,
});
