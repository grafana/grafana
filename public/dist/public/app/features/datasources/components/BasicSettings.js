import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { InlineField, InlineSwitch, Input, Badge, useStyles2 } from '@grafana/ui';
export function BasicSettings({ dataSourceName, isDefault, onDefaultChange, onNameChange, alertingSupported, disabled, }) {
    return (React.createElement(React.Fragment, null,
        !config.featureToggles.dataSourcePageHeader && React.createElement(AlertingEnabled, { enabled: alertingSupported }),
        React.createElement("div", { className: "gf-form-group", "aria-label": "Datasource settings page basic settings" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form max-width-30" },
                    React.createElement(InlineField, { label: "Name", tooltip: "The name is used when you select the data source in panels. The default data source is\n              'preselected in new panels.", grow: true, disabled: disabled },
                        React.createElement(Input, { id: "basic-settings-name", type: "text", value: dataSourceName, placeholder: "Name", onChange: (event) => onNameChange(event.currentTarget.value), required: true, "aria-label": selectors.pages.DataSource.name }))),
                React.createElement(InlineField, { label: "Default", labelWidth: 8, disabled: disabled },
                    React.createElement(InlineSwitch, { id: "basic-settings-default", value: isDefault, onChange: (event) => {
                            onDefaultChange(event.currentTarget.checked);
                        } }))))));
}
export function AlertingEnabled({ enabled }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.badge }, enabled ? (React.createElement(Badge, { color: "green", icon: "check-circle", text: "Alerting supported" })) : (React.createElement(Badge, { color: "orange", icon: "exclamation-triangle", text: "Alerting not supported" }))));
}
const getStyles = (theme) => ({
    badge: css `
    margin-bottom: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=BasicSettings.js.map