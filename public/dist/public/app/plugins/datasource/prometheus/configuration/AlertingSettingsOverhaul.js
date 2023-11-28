import { cx } from '@emotion/css';
import React from 'react';
import { ConfigSubSection } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { InlineField, Switch, useTheme2 } from '@grafana/ui';
import { docsTip, overhaulStyles } from './ConfigEditor';
export function AlertingSettingsOverhaul({ options, onOptionsChange, }) {
    const theme = useTheme2();
    const styles = overhaulStyles(theme);
    const prometheusConfigOverhaulAuth = config.featureToggles.prometheusConfigOverhaulAuth;
    return (React.createElement(ConfigSubSection, { title: "Alerting", className: cx(styles.container, { [styles.alertingTop]: prometheusConfigOverhaulAuth }) },
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineField, { labelWidth: 30, label: "Manage alerts via Alerting UI", disabled: options.readOnly, tooltip: React.createElement(React.Fragment, null,
                            "Manage alert rules for this data source. To manage other alerting resources, add an Alertmanager data source. ",
                            docsTip()), interactive: true, className: styles.switchField },
                        React.createElement(Switch, { value: options.jsonData.manageAlerts !== false, onChange: (event) => onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { manageAlerts: event.currentTarget.checked }) })) })))))));
}
//# sourceMappingURL=AlertingSettingsOverhaul.js.map