import { css, cx } from '@emotion/css';
import React from 'react';
import { Button, InfoBox, Portal, stylesFactory, useTheme2 } from '@grafana/ui';
import { getModalStyles } from '@grafana/ui/src/components/Modal/getModalStyles';
export const TokenRevokedModal = (props) => {
    const theme = useTheme2();
    const styles = getStyles(theme);
    const modalStyles = getModalStyles(theme);
    const showMaxConcurrentSessions = Boolean(props.maxConcurrentSessions);
    const redirectToLogin = () => {
        window.location.reload();
    };
    return (React.createElement(Portal, null,
        React.createElement("div", { className: modalStyles.modal },
            React.createElement(InfoBox, { title: "You have been automatically signed out", severity: "warning", className: styles.infobox },
                React.createElement("div", { className: styles.text },
                    React.createElement("p", null,
                        "Your session token was automatically revoked because you have reached",
                        React.createElement("strong", null, ` the maximum number of ${showMaxConcurrentSessions ? props.maxConcurrentSessions : ''} concurrent sessions `),
                        "for your account."),
                    React.createElement("p", null,
                        React.createElement("strong", null, "To resume your session, sign in again."),
                        "Contact your administrator or visit the license page to review your quota if you are repeatedly signed out automatically.")),
                React.createElement(Button, { size: "md", variant: "primary", onClick: redirectToLogin }, "Sign in"))),
        React.createElement("div", { className: cx(modalStyles.modalBackdrop, styles.backdrop) })));
};
const getStyles = stylesFactory((theme) => {
    return {
        infobox: css `
      margin-bottom: 0;
    `,
        text: css `
      margin: ${theme.spacing(1, 0, 2)};
    `,
        backdrop: css `
      background-color: ${theme.colors.background.canvas};
      opacity: 0.8;
    `,
    };
});
//# sourceMappingURL=TokenRevokedModal.js.map