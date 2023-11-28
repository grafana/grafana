import React, { useEffect } from 'react';
import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { AdvancedHttpSettings, Auth, AuthMethod, ConfigSection, ConnectionSettings, convertLegacyAuthProps, DataSourceDescription, } from '@grafana/experimental';
import { Alert, SecureSocksProxySettings } from '@grafana/ui';
import { Divider } from 'app/core/components/Divider';
import { config } from 'app/core/config';
import { DataLinks } from './DataLinks';
import { ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';
import { coerceOptions, isValidOptions } from './utils';
export const ConfigEditor = (props) => {
    const { options, onOptionsChange } = props;
    useEffect(() => {
        if (!isValidOptions(options)) {
            onOptionsChange(coerceOptions(options));
        }
    }, [onOptionsChange, options]);
    const authProps = convertLegacyAuthProps({
        config: options,
        onChange: onOptionsChange,
    });
    if (config.sigV4AuthEnabled) {
        authProps.customMethods = [
            {
                id: 'custom-sigv4',
                label: 'SigV4 auth',
                description: 'AWS Signature Version 4 authentication',
                component: React.createElement(SIGV4ConnectionConfig, Object.assign({ inExperimentalAuthComponent: true }, props)),
            },
        ];
        authProps.selectedMethod = options.jsonData.sigV4Auth ? 'custom-sigv4' : authProps.selectedMethod;
    }
    return (React.createElement(React.Fragment, null,
        options.access === 'direct' && (React.createElement(Alert, { title: "Error", severity: "error" }, "Browser access mode in the Elasticsearch datasource is no longer available. Switch to server access mode.")),
        React.createElement(DataSourceDescription, { dataSourceName: "Elasticsearch", docsLink: "https://grafana.com/docs/grafana/latest/datasources/elasticsearch", hasRequiredFields: false }),
        React.createElement(Divider, null),
        React.createElement(ConnectionSettings, { config: options, onChange: onOptionsChange, urlPlaceholder: "http://localhost:9200" }),
        React.createElement(Divider, null),
        React.createElement(Auth, Object.assign({}, authProps, { onAuthMethodSelect: (method) => {
                onOptionsChange(Object.assign(Object.assign({}, options), { basicAuth: method === AuthMethod.BasicAuth, withCredentials: method === AuthMethod.CrossSiteCredentials, jsonData: Object.assign(Object.assign({}, options.jsonData), { sigV4Auth: method === 'custom-sigv4', oauthPassThru: method === AuthMethod.OAuthForward }) }));
            } })),
        React.createElement(Divider, null),
        React.createElement(ConfigSection, { title: "Additional settings", description: "Additional settings are optional settings that can be configured for more control over your data source.", isCollapsible: true, isInitiallyOpen: true },
            React.createElement(AdvancedHttpSettings, { config: options, onChange: onOptionsChange }),
            React.createElement(Divider, { hideLine: true }),
            config.secureSocksDSProxyEnabled && (React.createElement(SecureSocksProxySettings, { options: options, onOptionsChange: onOptionsChange })),
            React.createElement(ElasticDetails, { value: options, onChange: onOptionsChange }),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(LogsConfig, { value: options.jsonData, onChange: (newValue) => onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: newValue })) }),
            React.createElement(Divider, { hideLine: true }),
            React.createElement(DataLinks, { value: options.jsonData.dataLinks, onChange: (newValue) => {
                    onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { dataLinks: newValue }) }));
                } }))));
};
//# sourceMappingURL=ConfigEditor.js.map