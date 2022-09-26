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
    if (!value.isValid) {
      alert = (
        <Alert severity="warning" title="Dashboard failed validation">
          <div className={styles.error}>{value.message}</div>
        </Alert>
      );
    }
  } else {
    const errorMessage = error?.message ?? error?.toString?.() ?? 'Unknown error';
    alert = (
      <Alert severity="info" title="Error checking dashboard validity">
        <div className={styles.error}>{errorMessage}</div>
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
    whiteSpace: 'pre-wrap',
    overflowX: 'auto',
    maxWidth: '100%',
  }),
});

export default DashboardValidation;
