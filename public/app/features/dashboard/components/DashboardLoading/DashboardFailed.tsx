import { css } from '@emotion/css';
import React from 'react';

import { Alert } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';
import { DashboardInitError, AppNotificationSeverity } from 'app/types';

export interface Props {
  initError?: DashboardInitError;
}

export const DashboardFailed = ({ initError }: Props) => {
  if (!initError) {
    return null;
  }

  return (
    <div className={styles.dashboardLoading}>
      <Alert severity={AppNotificationSeverity.Error} title={initError.message}>
        {getMessageFromError(initError.error)}
      </Alert>
    </div>
  );
};

export const styles = {
  dashboardLoading: css`
    height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
};
