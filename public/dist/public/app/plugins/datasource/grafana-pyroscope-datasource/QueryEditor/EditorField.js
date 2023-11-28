import { __rest } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { Field, Icon, ReactUtils, stylesFactory, Tooltip, useTheme2 } from '@grafana/ui';
export const EditorField = (props) => {
    const { label, optional, tooltip, children, width } = props, fieldProps = __rest(props, ["label", "optional", "tooltip", "children", "width"]);
    const theme = useTheme2();
    const styles = getStyles(theme, width);
    // Null check for backward compatibility
    const childInputId = (fieldProps === null || fieldProps === void 0 ? void 0 : fieldProps.htmlFor) || (ReactUtils === null || ReactUtils === void 0 ? void 0 : ReactUtils.getChildId(children));
    const labelEl = (React.createElement(React.Fragment, null,
        React.createElement("label", { className: styles.label, htmlFor: childInputId },
            label,
            optional && React.createElement("span", { className: styles.optional }, " - optional"),
            tooltip && (React.createElement(Tooltip, { placement: "top", content: tooltip, theme: "info" },
                React.createElement(Icon, { name: "info-circle", size: "sm", className: styles.icon })))),
        React.createElement("span", { className: styles.space })));
    return (React.createElement("div", { className: styles.root },
        React.createElement(Field, Object.assign({ className: styles.field, label: labelEl }, fieldProps), children)));
};
const getStyles = stylesFactory((theme, width) => {
    return {
        space: css({
            paddingRight: theme.spacing(0),
            paddingBottom: theme.spacing(0.5),
        }),
        root: css({
            minWidth: theme.spacing(width !== null && width !== void 0 ? width : 0),
        }),
        label: css({
            fontSize: 12,
            fontWeight: theme.typography.fontWeightMedium,
        }),
        optional: css({
            fontStyle: 'italic',
            color: theme.colors.text.secondary,
        }),
        field: css({
            marginBottom: 0, // GrafanaUI/Field has a bottom margin which we must remove
        }),
        icon: css({
            color: theme.colors.text.secondary,
            marginLeft: theme.spacing(1),
            ':hover': {
                color: theme.colors.text.primary,
            },
        }),
    };
});
//# sourceMappingURL=EditorField.js.map