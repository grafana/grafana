import { css } from '@emotion/css';
import React from 'react';
import { Alert } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';
import { AppNotificationSeverity } from 'app/types';
export const DashboardFailed = ({ initError }) => {
    if (!initError) {
        return null;
    }
    return (React.createElement("div", { className: styles.dashboardLoading },
        React.createElement(Alert, { severity: AppNotificationSeverity.Error, title: initError.message }, getMessageFromError(initError.error))));
};
export const styles = {
    dashboardLoading: css `
    height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
};
//# sourceMappingURL=DashboardFailed.js.map