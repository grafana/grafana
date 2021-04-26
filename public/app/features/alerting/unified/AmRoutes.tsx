import React, { FC, useEffect, useMemo } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Field, Icon, InfoBox, useStyles } from '@grafana/ui';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AmRootRoute } from './components/amroutes/AmRootRoute';
import { AmSpecificRouting } from './components/amroutes/AmSpecificRouting';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction } from './state/actions';
import { computeDefaultValuesRoute, mapObjectsToSelectableValue } from './utils/amroutes';
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
    <AlertingPageWrapper pageId="am-routes" isLoading={loading}>
      <Field label="Choose alert manager">
        <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      </Field>
      {error && (
        <InfoBox
          severity="error"
          title={
            <h4>
              <Icon className={styles.iconError} name="exclamation-triangle" size="xl" />
              Errors loading AlertManager config
            </h4>
          }
        >
          {error.message || 'Unknown error.'}
        </InfoBox>
      )}
      {result && (
        <>
          <div className={styles.break} />
          <AmRootRoute routes={routes} receivers={receivers} />
          <div className={styles.break} />
          <AmSpecificRouting routes={routes} receivers={receivers} />
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
