import React from 'react';
import { Icon, RadioButtonList, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { OrgRole } from 'app/types';
import { getStyles } from './styles';
const BasicRoleOption = Object.values(OrgRole).map((r) => ({
    label: r === OrgRole.None ? 'No basic role' : r,
    value: r,
}));
export const BuiltinRoleSelector = ({ value, onChange, disabled, disabledMesssage, tooltipMessage }) => {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.groupHeader },
            React.createElement("span", { style: { marginRight: theme.spacing(1) } }, "Basic roles"),
            disabled && disabledMesssage && (React.createElement(Tooltip, { placement: "right-end", interactive: true, content: React.createElement("div", null, disabledMesssage) },
                React.createElement(Icon, { name: "question-circle" }))),
            !disabled && tooltipMessage && (React.createElement(Tooltip, { placement: "right-end", interactive: true, content: tooltipMessage },
                React.createElement(Icon, { name: "info-circle", size: "xs" })))),
        React.createElement(RadioButtonList, { name: "Basic Role Selector", className: styles.basicRoleSelector, options: BasicRoleOption, value: value, onChange: onChange, disabled: disabled })));
};
//# sourceMappingURL=BuiltinRoleSelector.js.map