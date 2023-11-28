import React, { useMemo, useState } from 'react';
import { config } from '@grafana/runtime';
import { getCredentials, updateCredentials } from '../credentials';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { DefaultSubscription } from './DefaultSubscription';
const azureClouds = [
    { value: 'azuremonitor', label: 'Azure' },
    { value: 'govazuremonitor', label: 'Azure US Government' },
    { value: 'chinaazuremonitor', label: 'Azure China' },
];
export const MonitorConfig = (props) => {
    const { updateOptions, getSubscriptions, options } = props;
    const [subscriptions, setSubscriptions] = useState([]);
    const credentials = useMemo(() => getCredentials(props.options), [props.options]);
    const onCredentialsChange = (credentials, subscriptionId) => {
        if (!subscriptionId) {
            setSubscriptions([]);
        }
        updateOptions((options) => updateCredentials(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { subscriptionId }) }), credentials));
    };
    const onSubscriptionsChange = (receivedSubscriptions) => setSubscriptions(receivedSubscriptions);
    const onSubscriptionChange = (subscriptionId) => updateOptions((options) => (Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { subscriptionId }) })));
    return (React.createElement(React.Fragment, null,
        React.createElement(AzureCredentialsForm, { managedIdentityEnabled: config.azure.managedIdentityEnabled, workloadIdentityEnabled: config.azure.workloadIdentityEnabled, credentials: credentials, azureCloudOptions: azureClouds, onCredentialsChange: onCredentialsChange, disabled: props.options.readOnly },
            React.createElement(DefaultSubscription, { subscriptions: subscriptions, credentials: credentials, getSubscriptions: getSubscriptions, disabled: props.options.readOnly, onSubscriptionsChange: onSubscriptionsChange, onSubscriptionChange: onSubscriptionChange, options: options.jsonData }))));
};
export default MonitorConfig;
//# sourceMappingURL=MonitorConfig.js.map