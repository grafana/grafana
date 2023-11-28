import { css } from '@emotion/css';
import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
export function QueryErrorAlert({ error }) {
    var _a, _b, _c;
    const styles = useStyles2(getStyles);
    const message = (_c = (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : (_b = error === null || error === void 0 ? void 0 : error.data) === null || _b === void 0 ? void 0 : _b.message) !== null && _c !== void 0 ? _c : 'Query error';
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.icon },
            React.createElement(Icon, { name: "exclamation-triangle" })),
        React.createElement("div", { className: styles.message },
            message,
            error.traceId != null && (React.createElement(React.Fragment, null,
                React.createElement("br", null),
                " ",
                React.createElement("span", null,
                    "(Trace ID: ",
                    error.traceId,
                    ")"))))));
}
const getStyles = (theme) => ({
    wrapper: css({
        marginTop: theme.spacing(0.5),
        background: theme.colors.background.secondary,
        display: 'flex',
    }),
    icon: css({
        background: theme.colors.error.main,
        color: theme.colors.error.contrastText,
        padding: theme.spacing(1),
    }),
    message: css({
        fontSize: theme.typography.bodySmall.fontSize,
        fontFamily: theme.typography.fontFamilyMonospace,
        padding: theme.spacing(1),
    }),
});
//# sourceMappingURL=QueryErrorAlert.js.map