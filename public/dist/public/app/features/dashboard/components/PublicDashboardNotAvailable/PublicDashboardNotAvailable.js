import { css, cx } from '@emotion/css';
import React from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { useStyles2 } from '@grafana/ui/src';
import { Branding } from '../../../../core/components/Branding/Branding';
import { getLoginStyles } from '../../../../core/components/Login/LoginLayout';
const selectors = e2eSelectors.pages.PublicDashboard.NotAvailable;
export const PublicDashboardNotAvailable = ({ paused }) => {
    const styles = useStyles2(getStyles);
    const loginStyles = useStyles2(getLoginStyles);
    const loginBoxBackground = Branding.LoginBoxBackground();
    return (React.createElement(Branding.LoginBackground, { className: styles.container, "data-testid": selectors.container },
        React.createElement("div", { className: cx(styles.box, loginBoxBackground) },
            React.createElement(Branding.LoginLogo, { className: loginStyles.loginLogo }),
            React.createElement("p", { className: styles.title, "data-testid": selectors.title }, paused
                ? 'This dashboard has been paused by the administrator'
                : 'The dashboard your are trying to access does not exist'),
            paused && (React.createElement("p", { className: styles.description, "data-testid": selectors.pausedDescription }, "Try again later")))));
};
const getStyles = (theme) => ({
    container: css `
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;

    :before {
      opacity: 1;
    }
  `,
    box: css `
    width: 608px;
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: ${theme.spacing(4)};
    z-index: 1;
    border-radius: ${theme.shape.borderRadius(4)};
    padding: ${theme.spacing(6, 8)};
    opacity: 1;
  `,
    title: css `
    font-size: ${theme.typography.h3.fontSize};
    text-align: center;
    margin: 0;
  `,
    description: css `
    font-size: ${theme.typography.h5.fontSize};
    margin: 0;
  `,
});
//# sourceMappingURL=PublicDashboardNotAvailable.js.map