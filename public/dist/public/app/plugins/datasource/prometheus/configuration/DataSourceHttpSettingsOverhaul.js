import React, { useState } from 'react';
import { Auth, ConnectionSettings, convertLegacyAuthProps, AuthMethod } from '@grafana/experimental';
import { SecureSocksProxySettings, useTheme2 } from '@grafana/ui';
import { docsTip, overhaulStyles } from './ConfigEditor';
export const DataSourcehttpSettingsOverhaul = (props) => {
    const { options, onOptionsChange, azureAuthSettings, sigV4AuthToggleEnabled, renderSigV4Editor, secureSocksDSProxyEnabled, } = props;
    const newAuthProps = convertLegacyAuthProps({
        config: options,
        onChange: onOptionsChange,
    });
    const theme = useTheme2();
    const styles = overhaulStyles(theme);
    // for custom auth methods sigV4 and azure auth
    let customMethods = [];
    const [sigV4Selected, setSigV4Selected] = useState(options.jsonData.sigV4Auth || false);
    const sigV4Id = 'custom-sigV4Id';
    const sigV4Option = {
        id: sigV4Id,
        label: 'SigV4 auth',
        description: 'This is SigV4 auth description',
        component: React.createElement(React.Fragment, null, renderSigV4Editor),
    };
    if (sigV4AuthToggleEnabled) {
        customMethods.push(sigV4Option);
    }
    const azureAuthEnabled = ((azureAuthSettings === null || azureAuthSettings === void 0 ? void 0 : azureAuthSettings.azureAuthSupported) && azureAuthSettings.getAzureAuthEnabled(options)) || false;
    const [azureAuthSelected, setAzureAuthSelected] = useState(azureAuthEnabled);
    const azureAuthId = 'custom-azureAuthId';
    const azureAuthOption = {
        id: azureAuthId,
        label: 'Azure auth',
        description: 'This is Azure auth description',
        component: (React.createElement(React.Fragment, null, azureAuthSettings.azureSettingsUI && (React.createElement(azureAuthSettings.azureSettingsUI, { dataSourceConfig: options, onChange: onOptionsChange })))),
    };
    // allow the option to show in the dropdown
    if (azureAuthSettings === null || azureAuthSettings === void 0 ? void 0 : azureAuthSettings.azureAuthSupported) {
        customMethods.push(azureAuthOption);
    }
    function returnSelectedMethod() {
        if (sigV4Selected) {
            return sigV4Id;
        }
        if (azureAuthSelected) {
            return azureAuthId;
        }
        return newAuthProps.selectedMethod;
    }
    // Do we need this switch anymore? Update the language.
    let urlTooltip;
    switch (options.access) {
        case 'direct':
            urlTooltip = (React.createElement(React.Fragment, null,
                "Your access method is ",
                React.createElement("em", null, "Browser"),
                ", this means the URL needs to be accessible from the browser.",
                docsTip()));
            break;
        case 'proxy':
            urlTooltip = (React.createElement(React.Fragment, null,
                "Your access method is ",
                React.createElement("em", null, "Server"),
                ", this means the URL needs to be accessible from the grafana backend/server.",
                docsTip()));
            break;
        default:
            urlTooltip = React.createElement(React.Fragment, null,
                "Specify a complete HTTP URL (for example http://your_server:8080) ",
                docsTip());
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(ConnectionSettings, { urlPlaceholder: "http://localhost:9090", config: options, onChange: onOptionsChange, urlLabel: "Prometheus server URL", urlTooltip: urlTooltip }),
        React.createElement("hr", { className: `${styles.hrTopSpace} ${styles.hrBottomSpace}` }),
        React.createElement(Auth, Object.assign({}, newAuthProps, { customMethods: customMethods, onAuthMethodSelect: (method) => {
                // sigV4Id
                if (sigV4AuthToggleEnabled) {
                    setSigV4Selected(method === sigV4Id);
                }
                // Azure
                if (azureAuthSettings === null || azureAuthSettings === void 0 ? void 0 : azureAuthSettings.azureAuthSupported) {
                    setAzureAuthSelected(method === azureAuthId);
                    azureAuthSettings.setAzureAuthEnabled(options, method === azureAuthId);
                }
                onOptionsChange(Object.assign(Object.assign({}, options), { basicAuth: method === AuthMethod.BasicAuth, withCredentials: method === AuthMethod.CrossSiteCredentials, jsonData: Object.assign(Object.assign({}, options.jsonData), { sigV4Auth: method === sigV4Id, oauthPassThru: method === AuthMethod.OAuthForward }) }));
            }, 
            // If your method is selected pass its id to `selectedMethod`,
            // otherwise pass the id from converted legacy data
            selectedMethod: returnSelectedMethod() })),
        React.createElement("div", { className: styles.sectionBottomPadding }),
        secureSocksDSProxyEnabled && (React.createElement(React.Fragment, null,
            React.createElement(SecureSocksProxySettings, { options: options, onOptionsChange: onOptionsChange }),
            React.createElement("div", { className: styles.sectionBottomPadding })))));
};
//# sourceMappingURL=DataSourceHttpSettingsOverhaul.js.map