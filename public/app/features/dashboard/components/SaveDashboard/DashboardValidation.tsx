import { css } from '@emotion/css';
import * as React from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { FetchError } from '@grafana/runtime';
import { Alert, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardModel } from '../../state/DashboardModel';

interface DashboardValidationProps {
  dashboard: DashboardModel;
}

type ValidationResponse = Awaited<ReturnType<typeof backendSrv.validateDashboard>>;

function DashboardValidation({ dashboard }: DashboardValidationProps) {
  const styles = useStyles2(getStyles);
  const { loading, value, error } = useAsync(async () => {
    const saveModel = dashboard.getSaveModelCloneOld();
    const respPromise = backendSrv
      .validateDashboard(saveModel)
      // API returns schema validation errors in 4xx range, so resolve them rather than throwing
      .catch((err: FetchError<ValidationResponse>) => {
        if (err.status >= 500) {
          throw err;
        }

        return err.data;
      });

    return respPromise;
  }, [dashboard]);

  let alert: React.ReactNode;

  if (loading) {
    alert = (
      <Alert
        severity="info"
        title={t('dashboard.dashboard-validation.title-checking-dashboard-validity', 'Checking dashboard validity')}
      />
    );
  } else if (value) {
    if (!value.isValid) {
      alert = (
        <Alert
          severity="warning"
          title={t(
            'dashboard.dashboard-validation.title-dashboard-failed-schema-validation',
            'Dashboard failed schema validation'
          )}
        >
          <p>
            <Trans i18nKey="dashboard.dashboard-validation.body-dashboard-failed-schema-validation">
              Validation is provided for development purposes and should be safe to ignore. If you are a Grafana
              developer, consider checking and updating the dashboard schema
            </Trans>
          </p>
          <div className={styles.error}>{value.message}</div>
        </Alert>
      );
    }
  } else {
    const errorMessage = error?.message ?? 'Unknown error';
    alert = (
      <Alert
        severity="info"
        title={t(
          'dashboard.dashboard-validation.title-error-checking-dashboard-validity',
          'Error checking dashboard validity'
        )}
      >
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
