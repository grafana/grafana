import React, { PureComponent } from 'react';
import { ConfigSection, DataSourceDescription } from '@grafana/experimental';
import { ConnectionConfig } from '@grafana/google-sdk';
import { reportInteraction } from '@grafana/runtime';
import { Divider, SecureSocksProxySettings } from '@grafana/ui';
import { config } from 'app/core/config';
export class ConfigEditor extends PureComponent {
    constructor() {
        super(...arguments);
        this.handleOnOptionsChange = (options) => {
            if (options.jsonData.privateKeyPath || options.secureJsonFields['privateKey']) {
                reportInteraction('grafana_cloud_monitoring_config_changed', {
                    authenticationType: 'JWT',
                    privateKey: options.secureJsonFields['privateKey'],
                    privateKeyPath: !!options.jsonData.privateKeyPath,
                });
            }
            this.props.onOptionsChange(options);
        };
    }
    render() {
        const { options, onOptionsChange } = this.props;
        return (React.createElement(React.Fragment, null,
            React.createElement(DataSourceDescription, { dataSourceName: "Google Cloud Monitoring", docsLink: "https://grafana.com/docs/grafana/latest/datasources/google-cloud-monitoring/", hasRequiredFields: true }),
            React.createElement(Divider, null),
            React.createElement(ConnectionConfig, Object.assign({}, this.props, { onOptionsChange: this.handleOnOptionsChange })),
            config.secureSocksDSProxyEnabled && (React.createElement(React.Fragment, null,
                React.createElement(Divider, null),
                React.createElement(ConfigSection, { title: "Additional settings", description: "Additional settings are optional settings that can be configured for more control over your data source. This includes Secure Socks Proxy.", isCollapsible: true, isInitiallyOpen: options.jsonData.enableSecureSocksProxy !== undefined },
                    React.createElement(SecureSocksProxySettings, { options: options, onOptionsChange: onOptionsChange }))))));
    }
}
//# sourceMappingURL=ConfigEditor.js.map