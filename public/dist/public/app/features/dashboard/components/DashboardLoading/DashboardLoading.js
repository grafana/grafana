import { css, keyframes } from '@emotion/css';
import React from 'react';
import { locationService } from '@grafana/runtime';
import { Button, HorizontalGroup, Spinner, useStyles2, VerticalGroup } from '@grafana/ui';
export const DashboardLoading = ({ initPhase }) => {
    const styles = useStyles2(getStyles);
    const cancelVariables = () => {
        locationService.push('/');
    };
    return (React.createElement("div", { className: styles.dashboardLoading },
        React.createElement("div", { className: styles.dashboardLoadingText },
            React.createElement(VerticalGroup, { spacing: "md" },
                React.createElement(HorizontalGroup, { align: "center", justify: "center", spacing: "xs" },
                    React.createElement(Spinner, { inline: true }),
                    " ",
                    initPhase),
                ' ',
                React.createElement(HorizontalGroup, { align: "center", justify: "center" },
                    React.createElement(Button, { variant: "secondary", size: "md", icon: "repeat", onClick: cancelVariables }, "Cancel loading dashboard"))))));
};
export const getStyles = (theme) => {
    // Amount of time we want to pass before we start showing loading spinner
    const slowStartThreshold = '0.5s';
    const invisibleToVisible = keyframes `
    0% { opacity: 0%; }
    100% { opacity: 100%; }
  `;
    return {
        dashboardLoading: css `
      height: 60vh;
      display: flex;
      opacity: 0%;
      align-items: center;
      justify-content: center;
      animation: ${invisibleToVisible} 0s step-end ${slowStartThreshold} 1 normal forwards;
    `,
        dashboardLoadingText: css `
      font-size: ${theme.typography.h4.fontSize};
    `,
    };
};
//# sourceMappingURL=DashboardLoading.js.map