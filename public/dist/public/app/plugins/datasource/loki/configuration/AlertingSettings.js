import React from 'react';
import { ConfigSubSection } from '@grafana/experimental';
import { InlineField, InlineSwitch } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
export function AlertingSettings({ options, onOptionsChange, }) {
    return (React.createElement(ConfigSubSection, { title: "Alerting", description: React.createElement(ConfigDescriptionLink, { description: "Manage alert rules for the Loki data source.", suffix: "loki/configure-loki-data-source/#alerting", feature: "alerting" }) },
        React.createElement(InlineField, { labelWidth: 29, label: "Manage alert rules in Alerting UI", disabled: options.readOnly, tooltip: "Manage alert rules for this data source. To manage other alerting resources, add an Alertmanager data source." },
            React.createElement(InlineSwitch, { value: options.jsonData.manageAlerts !== false, onChange: (event) => onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { manageAlerts: event.currentTarget.checked }) })) }))));
}
//# sourceMappingURL=AlertingSettings.js.map