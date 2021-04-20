import React, { FC, useEffect } from 'react';
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
  const rootRoute = config?.route;
  const receivers = (config?.receivers ?? []).map((receiver) => ({
    label: receiver['name'],
    value: receiver['name'],
  }));

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
          <AmRootRoute receivers={receivers} route={rootRoute} />
          <div className={styles.break} />
          <AmSpecificRouting receivers={receivers} route={rootRoute} />
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
