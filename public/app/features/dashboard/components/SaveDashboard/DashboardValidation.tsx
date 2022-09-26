import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardModel } from '../../state';

interface DashboardValidationProps {
  dashboard: DashboardModel;
}

function DashboardValidation({ dashboard }: DashboardValidationProps) {
  const styles = useStyles2(getStyles);

  const { loading, value, error } = useAsync(async () => {
    const saveModel = dashboard.getSaveModelClone();
    const validationResponse = await backendSrv.validateDashboard(saveModel);
    return validationResponse;
  }, [dashboard]);

  let alert: React.ReactNode;

  if (loading) {
    alert = <Alert severity="info" title="Checking dashboard validity" />;
  } else if (value) {
    // API will respond with status 200 even if the dashboard is invalid.
    if (!value.isValid) {
      alert = (
        <Alert severity="warning" title="Dashboard failed schema validation">
          <p>
            Validation is provided for development purposes and should be safe to ignore. If you are a Grafana
            developer, consider checking and updating the dashboard schema
          </p>
          <div className={styles.error}>{value.message}</div>
        </Alert>
      );
    }
  } else {
    // non-200 response from the API. This shouldn't happen normally
    const errorMessage = error?.message ?? error?.toString?.() ?? 'Unknown error';
    alert = (
      <Alert severity="info" title="Error checking dashboard validity">
        <p className={styles.error}>{errorMessage}</p>
      </Alert>
    );
  }

  if (alert) {
    return <div className={styles.root}>{alert}</div>;
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    marginTop: theme.spacing(1),
  }),
  error: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    whiteSpace: 'pre-wrap',
    overflowX: 'auto',
    maxWidth: '100%',
  }),
});

export default DashboardValidation;
