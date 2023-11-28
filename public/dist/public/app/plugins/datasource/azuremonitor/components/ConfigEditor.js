import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { updateDatasourcePluginOption } from '@grafana/data';
import { ConfigSection, DataSourceDescription } from '@grafana/experimental';
import { getBackendSrv, getTemplateSrv, isFetchError } from '@grafana/runtime';
import { Alert, Divider, SecureSocksProxySettings } from '@grafana/ui';
import { config } from 'app/core/config';
import ResponseParser from '../azure_monitor/response_parser';
import { routeNames } from '../utils/common';
import { MonitorConfig } from './MonitorConfig';
export class ConfigEditor extends PureComponent {
    constructor(props) {
        super(props);
        this.templateSrv = getTemplateSrv();
        this.updateOptions = (optionsFunc) => {
            const updated = optionsFunc(this.props.options);
            this.props.onOptionsChange(updated);
            this.setState({ unsaved: true });
        };
        this.saveOptions = () => __awaiter(this, void 0, void 0, function* () {
            if (this.state.unsaved) {
                yield getBackendSrv()
                    .put(`/api/datasources/${this.props.options.id}`, this.props.options)
                    .then((result) => {
                    updateDatasourcePluginOption(this.props, 'version', result.datasource.version);
                });
                this.setState({ unsaved: false });
            }
        });
        this.getSubscriptions = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield this.saveOptions();
            const query = `?api-version=2019-03-01`;
            try {
                const result = yield getBackendSrv()
                    .fetch({
                    url: this.baseURL + query,
                    method: 'GET',
                })
                    .toPromise();
                this.setState({ error: undefined });
                return ResponseParser.parseSubscriptionsForSelect(result);
            }
            catch (err) {
                if (isFetchError(err)) {
                    this.setState({
                        error: {
                            title: 'Error requesting subscriptions',
                            description: 'Could not request subscriptions from Azure. Check your credentials and try again.',
                            details: (_a = err === null || err === void 0 ? void 0 : err.data) === null || _a === void 0 ? void 0 : _a.message,
                        },
                    });
                }
                return Promise.resolve([]);
            }
        });
        this.state = {
            unsaved: false,
        };
        this.baseURL = `/api/datasources/${this.props.options.id}/resources/${routeNames.azureMonitor}/subscriptions`;
    }
    render() {
        const { options, onOptionsChange } = this.props;
        const { error } = this.state;
        return (React.createElement(React.Fragment, null,
            React.createElement(DataSourceDescription, { dataSourceName: "Azure Monitor", docsLink: "https://grafana.com/docs/grafana/latest/datasources/azure-monitor/", hasRequiredFields: true }),
            React.createElement(Divider, null),
            React.createElement(MonitorConfig, { options: options, updateOptions: this.updateOptions, getSubscriptions: this.getSubscriptions }),
            error && (React.createElement(Alert, { severity: "error", title: error.title },
                React.createElement("p", null, error.description),
                error.details && React.createElement("details", { style: { whiteSpace: 'pre-wrap' } }, error.details))),
            config.secureSocksDSProxyEnabled && (React.createElement(React.Fragment, null,
                React.createElement(Divider, null),
                React.createElement(ConfigSection, { title: "Additional settings", description: "Additional settings are optional settings that can be configured for more control over your data source. This includes Secure Socks Proxy.", isCollapsible: true, isInitiallyOpen: options.jsonData.enableSecureSocksProxy !== undefined },
                    React.createElement(SecureSocksProxySettings, { options: options, onOptionsChange: onOptionsChange }))))));
    }
}
export default ConfigEditor;
//# sourceMappingURL=ConfigEditor.js.map