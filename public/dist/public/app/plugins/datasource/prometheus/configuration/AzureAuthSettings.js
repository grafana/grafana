import { cx } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { config } from '@grafana/runtime';
import { InlineField, InlineFieldRow, InlineSwitch, Input } from '@grafana/ui';
import { KnownAzureClouds } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';
export const AzureAuthSettings = (props) => {
    const { dataSourceConfig, onChange } = props;
    const [overrideAudienceChecked, setOverrideAudienceChecked] = useState(!!dataSourceConfig.jsonData.azureEndpointResourceId);
    const credentials = useMemo(() => getCredentials(dataSourceConfig), [dataSourceConfig]);
    const onCredentialsChange = (credentials) => {
        onChange(updateCredentials(dataSourceConfig, credentials));
    };
    const onOverrideAudienceChange = (ev) => {
        setOverrideAudienceChecked(ev.currentTarget.checked);
        if (!ev.currentTarget.checked) {
            onChange(Object.assign(Object.assign({}, dataSourceConfig), { jsonData: Object.assign(Object.assign({}, dataSourceConfig.jsonData), { azureEndpointResourceId: undefined }) }));
        }
    };
    const onResourceIdChange = (ev) => {
        if (overrideAudienceChecked) {
            onChange(Object.assign(Object.assign({}, dataSourceConfig), { jsonData: Object.assign(Object.assign({}, dataSourceConfig.jsonData), { azureEndpointResourceId: ev.currentTarget.value }) }));
        }
    };
    const prometheusConfigOverhaulAuth = config.featureToggles.prometheusConfigOverhaulAuth;
    const labelWidth = prometheusConfigOverhaulAuth ? 24 : 26;
    return (React.createElement(React.Fragment, null,
        React.createElement("h6", null, "Azure authentication"),
        React.createElement(AzureCredentialsForm, { managedIdentityEnabled: config.azure.managedIdentityEnabled, workloadIdentityEnabled: config.azure.workloadIdentityEnabled, credentials: credentials, azureCloudOptions: KnownAzureClouds, onCredentialsChange: onCredentialsChange, disabled: dataSourceConfig.readOnly }),
        React.createElement("h6", null, "Azure configuration"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { labelWidth: labelWidth, label: "Override AAD audience", disabled: dataSourceConfig.readOnly },
                    React.createElement(InlineSwitch, { value: overrideAudienceChecked, onChange: onOverrideAudienceChange }))),
            overrideAudienceChecked && (React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { labelWidth: labelWidth, label: "Resource ID", disabled: dataSourceConfig.readOnly },
                    React.createElement(Input, { className: cx(prometheusConfigOverhaulAuth ? 'width-20' : 'width-30'), value: dataSourceConfig.jsonData.azureEndpointResourceId || '', onChange: onResourceIdChange })))))));
};
export default AzureAuthSettings;
//# sourceMappingURL=AzureAuthSettings.js.map