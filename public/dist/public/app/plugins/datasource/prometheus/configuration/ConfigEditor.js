import React from 'react';
import { AlertingSettings, DataSourceHttpSettings, Alert } from '@grafana/ui';
import { config } from 'app/core/config';
import { AzureAuthSettings } from './AzureAuthSettings';
import { PromSettings } from './PromSettings';
import { getAllAlertmanagerDataSources } from 'app/features/alerting/unified/utils/alertmanager';
export var ConfigEditor = function (props) {
    var _a;
    var options = props.options, onOptionsChange = props.onOptionsChange;
    var alertmanagers = getAllAlertmanagerDataSources();
    var azureAuthSettings = {
        azureAuthEnabled: (_a = config.featureToggles['prometheus_azure_auth']) !== null && _a !== void 0 ? _a : false,
        azureSettingsUI: AzureAuthSettings,
    };
    return (React.createElement(React.Fragment, null,
        options.access === 'direct' && (React.createElement(Alert, { title: "Deprecation Notice", severity: "warning" }, "Browser access mode in the Prometheus datasource is deprecated and will be removed in a future release.")),
        React.createElement(DataSourceHttpSettings, { defaultUrl: "http://localhost:9090", dataSourceConfig: options, showAccessOptions: true, onChange: onOptionsChange, sigV4AuthToggleEnabled: config.sigV4AuthEnabled, azureAuthSettings: azureAuthSettings }),
        React.createElement(AlertingSettings, { alertmanagerDataSources: alertmanagers, options: options, onOptionsChange: onOptionsChange }),
        React.createElement(PromSettings, { options: options, onOptionsChange: onOptionsChange })));
};
//# sourceMappingURL=ConfigEditor.js.map