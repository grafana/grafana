import React, { PureComponent } from 'react';
import { updateDatasourcePluginJsonDataOption, onUpdateDatasourceJsonDataOptionSelect, onUpdateDatasourceJsonDataOptionChecked, } from '@grafana/data';
import { Alert, DataSourceHttpSettings, Field, FieldSet, Select, Switch } from '@grafana/ui';
import { config } from 'app/core/config';
import store from 'app/core/store';
import { GraphiteType } from '../types';
import { DEFAULT_GRAPHITE_VERSION, GRAPHITE_VERSIONS } from '../versions';
import { MappingsConfiguration } from './MappingsConfiguration';
import { fromString, toString } from './parseLokiLabelMappings';
export const SHOW_MAPPINGS_HELP_KEY = 'grafana.datasources.graphite.config.showMappingsHelp';
const graphiteVersions = GRAPHITE_VERSIONS.map((version) => ({ label: `${version}.x`, value: version }));
const graphiteTypes = Object.entries(GraphiteType).map(([label, value]) => ({
    label,
    value,
}));
export class ConfigEditor extends PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            showMappingsHelp: store.getObject(SHOW_MAPPINGS_HELP_KEY, true),
        };
    }
    componentDidMount() {
        updateDatasourcePluginJsonDataOption(this.props, 'graphiteVersion', this.currentGraphiteVersion);
    }
    render() {
        var _a, _b;
        const { options, onOptionsChange } = this.props;
        const currentVersion = graphiteVersions.find((item) => item.value === this.currentGraphiteVersion);
        return (React.createElement(React.Fragment, null,
            options.access === 'direct' && (React.createElement(Alert, { title: "Deprecation Notice", severity: "warning" }, "This data source uses browser access mode. This mode is deprecated and will be removed in the future. Please use server access mode instead.")),
            React.createElement(DataSourceHttpSettings, { defaultUrl: "http://localhost:8080", dataSourceConfig: options, onChange: onOptionsChange, secureSocksDSProxyEnabled: config.secureSocksDSProxyEnabled }),
            React.createElement(FieldSet, null,
                React.createElement("legend", { className: "page-heading" }, "Graphite details"),
                React.createElement(Field, { label: "Version", description: "This option controls what functions are available in the Graphite query editor." },
                    React.createElement(Select, { id: "graphite-version", "aria-label": "Graphite version", value: currentVersion, options: graphiteVersions, width: 16, onChange: onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteVersion') })),
                React.createElement(Field, { label: "Graphite backend type", description: "There are different types of Graphite compatible backends. Here you can specify the type you are using. For Metrictank, this will enable specific features, like query processing meta data. Metrictank\n        is a multi-tenant timeseries engine for Graphite and friends." },
                    React.createElement(Select, { id: "backend-type", options: graphiteTypes, value: graphiteTypes.find((type) => type.value === options.jsonData.graphiteType), width: 16, onChange: onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteType') })),
                options.jsonData.graphiteType === GraphiteType.Metrictank && (React.createElement(Field, { label: "Rollup indicator", description: "Shows up as an info icon in panel headers when data is aggregated." },
                    React.createElement(Switch, { id: "rollup-indicator", value: !!options.jsonData.rollupIndicatorEnabled, onChange: onUpdateDatasourceJsonDataOptionChecked(this.props, 'rollupIndicatorEnabled') })))),
            React.createElement(MappingsConfiguration, { mappings: (((_b = (_a = options.jsonData.importConfiguration) === null || _a === void 0 ? void 0 : _a.loki) === null || _b === void 0 ? void 0 : _b.mappings) || []).map(toString), showHelp: this.state.showMappingsHelp, onDismiss: () => {
                    this.setState({ showMappingsHelp: false });
                    store.setObject(SHOW_MAPPINGS_HELP_KEY, false);
                }, onRestoreHelp: () => {
                    this.setState({ showMappingsHelp: true });
                    store.setObject(SHOW_MAPPINGS_HELP_KEY, true);
                }, onChange: (mappings) => {
                    onOptionsChange(Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { importConfiguration: Object.assign(Object.assign({}, options.jsonData.importConfiguration), { loki: {
                                    mappings: mappings.map(fromString),
                                } }) }) }));
                } })));
    }
    get currentGraphiteVersion() {
        return this.props.options.jsonData.graphiteVersion || DEFAULT_GRAPHITE_VERSION;
    }
}
//# sourceMappingURL=ConfigEditor.js.map