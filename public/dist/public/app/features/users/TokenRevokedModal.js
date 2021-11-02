import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Button, InfoBox, Portal, stylesFactory, useTheme2 } from '@grafana/ui';
import { getModalStyles } from '@grafana/ui/src/components/Modal/getModalStyles';
import { css, cx } from '@emotion/css';
export var TokenRevokedModal = function (props) {
    var theme = useTheme2();
    var styles = getStyles(theme);
    var modalStyles = getModalStyles(theme);
    var showMaxConcurrentSessions = Boolean(props.maxConcurrentSessions);
    var redirectToLogin = function () {
        window.location.reload();
    };
    return (React.createElement(Portal, null,
        React.createElement("div", { className: modalStyles.modal },
            React.createElement(InfoBox, { title: "You have been automatically signed out", severity: "warning", className: styles.infobox },
                React.createElement("div", { className: styles.text },
                    React.createElement("p", null,
                        "Your session token was automatically revoked because you have reached",
                        React.createElement("strong", null, " the maximum number of " + (showMaxConcurrentSessions ? props.maxConcurrentSessions : '') + " concurrent sessions "),
                        "for your account."),
                    React.createElement("p", null,
                        React.createElement("strong", null, "To resume your session, sign in again."),
                        "Contact your administrator or visit the license page to review your quota if you are repeatedly signed out automatically.")),
                React.createElement(Button, { size: "md", variant: "primary", onClick: redirectToLogin }, "Sign in"))),
        React.createElement("div", { className: cx(modalStyles.modalBackdrop, styles.backdrop) })));
};
var getStyles = stylesFactory(function (theme) {
    return {
        infobox: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: 0;\n    "], ["\n      margin-bottom: 0;\n    "]))),
        text: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin: ", ";\n    "], ["\n      margin: ", ";\n    "])), theme.spacing(1, 0, 2)),
        backdrop: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      background-color: ", ";\n      opacity: 0.8;\n    "], ["\n      background-color: ", ";\n      opacity: 0.8;\n    "])), theme.colors.background.canvas),
    };
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=TokenRevokedModal.js.map