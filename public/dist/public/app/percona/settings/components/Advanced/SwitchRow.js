import React from 'react';
import { Switch, useStyles2 } from '@grafana/ui';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { getStyles } from './Advanced.styles';
export const SwitchRow = ({ label, tooltip, tooltipLinkText = '', link = '', disabled, className, dataTestId, input, onChange, }) => {
    const settingsStyles = useStyles2(getSettingsStyles);
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.advancedRow, "data-testid": dataTestId },
        React.createElement("div", { className: styles.advancedCol },
            React.createElement("div", { className: settingsStyles.labelWrapper },
                React.createElement("span", null, label),
                !!tooltip && (React.createElement(LinkTooltip, { tooltipContent: tooltip, link: link, linkText: tooltipLinkText, icon: "info-circle" })))),
        React.createElement("div", { className: className },
            React.createElement(Switch, Object.assign({}, input, { checked: undefined, value: input.checked, disabled: disabled }, (onChange ? { onChange: (event) => onChange(event, input) } : {}))))));
};
//# sourceMappingURL=SwitchRow.js.map