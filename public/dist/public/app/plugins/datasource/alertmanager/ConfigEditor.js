import { produce } from 'immer';
import React from 'react';
import { Link } from 'react-router-dom';
import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { DataSourceHttpSettings, InlineField, InlineFormLabel, InlineSwitch, Select, Text } from '@grafana/ui';
import { config } from 'app/core/config';
import { AlertManagerImplementation } from './types';
const IMPL_OPTIONS = [
    {
        value: AlertManagerImplementation.mimir,
        label: 'Mimir',
        description: `https://grafana.com/oss/mimir/. An open source, horizontally scalable, highly available, multi-tenant, long-term storage for Prometheus.`,
    },
    {
        value: AlertManagerImplementation.cortex,
        label: 'Cortex',
        description: `https://cortexmetrics.io/`,
    },
    {
        value: AlertManagerImplementation.prometheus,
        label: 'Prometheus',
        description: 'https://prometheus.io/. Does not support editing configuration via API, so contact points and notification policies are read-only.',
    },
];
export const ConfigEditor = (props) => {
    var _a;
    const { options, onOptionsChange } = props;
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Alertmanager"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 13 }, "Implementation"),
                    React.createElement(Select, { width: 40, options: IMPL_OPTIONS, value: options.jsonData.implementation || AlertManagerImplementation.mimir, onChange: (value) => onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { implementation: value.value }) })) }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement(InlineField, { label: "Receive Grafana Alerts", tooltip: "When enabled, Grafana-managed alerts are sent to this Alertmanager.", labelWidth: 26 },
                    React.createElement(InlineSwitch, { value: (_a = options.jsonData.handleGrafanaManagedAlerts) !== null && _a !== void 0 ? _a : false, onChange: (e) => {
                            onOptionsChange(produce(options, (draft) => {
                                draft.jsonData.handleGrafanaManagedAlerts = e.currentTarget.checked;
                            }));
                        } }))),
            options.jsonData.handleGrafanaManagedAlerts && (React.createElement(Text, { variant: "bodySmall", color: "secondary" },
                "Make sure to enable the alert forwarding on the ",
                React.createElement(Link, { to: "/alerting/admin" }, "admin page"),
                "."))),
        React.createElement(DataSourceHttpSettings, { defaultUrl: '', dataSourceConfig: options, showAccessOptions: true, onChange: onOptionsChange, sigV4AuthToggleEnabled: config.sigV4AuthEnabled, renderSigV4Editor: React.createElement(SIGV4ConnectionConfig, Object.assign({}, props)), secureSocksDSProxyEnabled: false })));
};
//# sourceMappingURL=ConfigEditor.js.map