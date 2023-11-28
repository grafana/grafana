import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React, { forwardRef } from 'react';
import Skeleton from 'react-loading-skeleton';
import { Icon, getInputStyles, useTheme2, Text } from '@grafana/ui';
import { focusCss } from '@grafana/ui/src/themes/mixins';
import { Trans } from 'app/core/internationalization';
function Trigger(_a, ref) {
    var { isLoading, invalid, label } = _a, rest = __rest(_a, ["isLoading", "invalid", "label"]);
    const theme = useTheme2();
    const styles = getStyles(theme, invalid);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.inputWrapper },
            label ? (React.createElement("div", { className: styles.prefix },
                React.createElement(Icon, { name: "folder" }))) : undefined,
            React.createElement("button", Object.assign({ type: "button", className: cx(styles.fakeInput, label ? styles.hasPrefix : undefined) }, rest, { ref: ref }), isLoading ? (React.createElement(Skeleton, { width: 100 })) : label ? (React.createElement(Text, { truncate: true }, label)) : (React.createElement(Text, { truncate: true, color: "secondary" },
                React.createElement(Trans, { i18nKey: "browse-dashboards.folder-picker.button-label" }, "Select folder")))),
            React.createElement("div", { className: styles.suffix },
                React.createElement(Icon, { name: "angle-down" })))));
}
export default forwardRef(Trigger);
const getStyles = (theme, invalid = false) => {
    const baseStyles = getInputStyles({ theme, invalid });
    return {
        wrapper: baseStyles.wrapper,
        inputWrapper: baseStyles.inputWrapper,
        prefix: css([
            baseStyles.prefix,
            {
                pointerEvents: 'none',
                color: theme.colors.text.primary,
            },
        ]),
        suffix: css([
            baseStyles.suffix,
            {
                pointerEvents: 'none',
            },
        ]),
        fakeInput: css([
            baseStyles.input,
            {
                textAlign: 'left',
                letterSpacing: 'normal',
                // We want the focus styles to appear only when tabbing through, not when clicking the button
                // (and when focus is restored after command palette closes)
                '&:focus': {
                    outline: 'unset',
                    boxShadow: 'unset',
                },
                '&:focus-visible': css `
          ${focusCss(theme)}
        `,
            },
        ]),
        hasPrefix: css({
            paddingLeft: 28,
        }),
    };
};
//# sourceMappingURL=Trigger.js.map