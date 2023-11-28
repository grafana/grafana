import { __rest } from "tslib";
import { uniqueId } from 'lodash';
import React, { PureComponent } from 'react';
import { updateDatasourcePluginJsonDataOption, } from '@grafana/data/src';
import { Alert, DataSourceHttpSettings, InlineField, Select, Field, Input, FieldSet } from '@grafana/ui/src';
import { config } from 'app/core/config';
import { BROWSER_MODE_DISABLED_MESSAGE } from '../../../constants';
import { InfluxVersion } from '../../../types';
import { InfluxFluxConfig } from './InfluxFluxConfig';
import { InfluxInfluxQLConfig } from './InfluxInfluxQLConfig';
import { InfluxSqlConfig } from './InfluxSQLConfig';
const versionMap = {
    [InfluxVersion.InfluxQL]: {
        label: 'InfluxQL',
        value: InfluxVersion.InfluxQL,
        description: 'The InfluxDB SQL-like query language.',
    },
    [InfluxVersion.SQL]: {
        label: 'SQL',
        value: InfluxVersion.SQL,
        description: 'Native SQL language. Supported in InfluxDB 3.0',
    },
    [InfluxVersion.Flux]: {
        label: 'Flux',
        value: InfluxVersion.Flux,
        description: 'Supported in InfluxDB 2.x and 1.8+',
    },
};
const versions = [
    versionMap[InfluxVersion.InfluxQL],
    versionMap[InfluxVersion.Flux],
];
const versionsWithSQL = [
    versionMap[InfluxVersion.InfluxQL],
    versionMap[InfluxVersion.SQL],
    versionMap[InfluxVersion.Flux],
];
export class ConfigEditor extends PureComponent {
    constructor(props) {
        var _a;
        super(props);
        this.state = {
            maxSeries: '',
        };
        this.versionNotice = {
            Flux: 'Support for Flux in Grafana is currently in beta',
            SQL: 'Support for SQL in Grafana is currently in alpha',
        };
        this.onVersionChanged = (selected) => {
            const { options, onOptionsChange } = this.props;
            const copy = Object.assign(Object.assign({}, options), { jsonData: Object.assign(Object.assign({}, options.jsonData), { version: selected.value }) });
            if (selected.value === InfluxVersion.Flux) {
                copy.access = 'proxy';
                copy.basicAuth = true;
                copy.jsonData.httpMode = 'POST';
                // Remove old 1x configs
                const { user, database } = copy, rest = __rest(copy, ["user", "database"]);
                onOptionsChange(rest);
            }
            else {
                onOptionsChange(copy);
            }
        };
        this.state.maxSeries = ((_a = props.options.jsonData.maxSeries) === null || _a === void 0 ? void 0 : _a.toString()) || '';
        this.htmlPrefix = uniqueId('influxdb-config');
    }
    renderJsonDataOptions() {
        switch (this.props.options.jsonData.version) {
            case InfluxVersion.InfluxQL:
                return React.createElement(InfluxInfluxQLConfig, Object.assign({}, this.props));
            case InfluxVersion.Flux:
                return React.createElement(InfluxFluxConfig, Object.assign({}, this.props));
            case InfluxVersion.SQL:
                return React.createElement(InfluxSqlConfig, Object.assign({}, this.props));
            default:
                return React.createElement(InfluxInfluxQLConfig, Object.assign({}, this.props));
        }
    }
    render() {
        var _a;
        const { options, onOptionsChange } = this.props;
        const isDirectAccess = options.access === 'direct';
        return (React.createElement(React.Fragment, null,
            React.createElement(FieldSet, null,
                React.createElement("h3", { className: "page-heading" }, "Query language"),
                React.createElement(Field, null,
                    React.createElement(Select, { "aria-label": "Query language", className: "width-30", value: versionMap[(_a = options.jsonData.version) !== null && _a !== void 0 ? _a : InfluxVersion.InfluxQL], options: config.featureToggles.influxdbSqlSupport ? versionsWithSQL : versions, defaultValue: versionMap[InfluxVersion.InfluxQL], onChange: this.onVersionChanged }))),
            options.jsonData.version !== InfluxVersion.InfluxQL && (React.createElement(Alert, { severity: "info", title: this.versionNotice[options.jsonData.version] },
                React.createElement("p", null,
                    "Please report any issues to: ",
                    React.createElement("br", null),
                    React.createElement("a", { href: "https://github.com/grafana/grafana/issues/new/choose" }, "https://github.com/grafana/grafana/issues")))),
            isDirectAccess && (React.createElement(Alert, { title: "Error", severity: "error" }, BROWSER_MODE_DISABLED_MESSAGE)),
            React.createElement(DataSourceHttpSettings, { showAccessOptions: isDirectAccess, dataSourceConfig: options, defaultUrl: "http://localhost:8086", onChange: onOptionsChange, secureSocksDSProxyEnabled: config.secureSocksDSProxyEnabled }),
            React.createElement(FieldSet, null,
                React.createElement("h3", { className: "page-heading" }, "InfluxDB Details"),
                this.renderJsonDataOptions(),
                React.createElement(InlineField, { labelWidth: 20, label: "Max series", tooltip: "Limit the number of series/tables that Grafana will process. Lower this number to prevent abuse, and increase it if you have lots of small time series and not all are shown. Defaults to 1000." },
                    React.createElement(Input, { placeholder: "1000", type: "number", className: "width-20", value: this.state.maxSeries, onChange: (event) => {
                            // We duplicate this state so that we allow to write freely inside the input. We don't have
                            // any influence over saving so this seems to be only way to do this.
                            this.setState({ maxSeries: event.currentTarget.value });
                            const val = parseInt(event.currentTarget.value, 10);
                            updateDatasourcePluginJsonDataOption(this.props, 'maxSeries', Number.isFinite(val) ? val : undefined);
                        } })))));
    }
}
export default ConfigEditor;
//# sourceMappingURL=ConfigEditor.js.map