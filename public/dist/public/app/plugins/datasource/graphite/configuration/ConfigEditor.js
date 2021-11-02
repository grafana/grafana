import { __assign, __extends, __read } from "tslib";
import React, { PureComponent } from 'react';
import { Alert, DataSourceHttpSettings, InlineFormLabel, LegacyForms } from '@grafana/ui';
var Select = LegacyForms.Select, Switch = LegacyForms.Switch;
import { updateDatasourcePluginJsonDataOption, onUpdateDatasourceJsonDataOptionSelect, onUpdateDatasourceJsonDataOptionChecked, } from '@grafana/data';
import { GraphiteType } from '../types';
import { DEFAULT_GRAPHITE_VERSION, GRAPHITE_VERSIONS } from '../versions';
import { MappingsConfiguration } from './MappingsConfiguration';
import { fromString, toString } from './parseLokiLabelMappings';
import store from 'app/core/store';
export var SHOW_MAPPINGS_HELP_KEY = 'grafana.datasources.graphite.config.showMappingsHelp';
var graphiteVersions = GRAPHITE_VERSIONS.map(function (version) { return ({ label: version + ".x", value: version }); });
var graphiteTypes = Object.entries(GraphiteType).map(function (_a) {
    var _b = __read(_a, 2), label = _b[0], value = _b[1];
    return ({
        label: label,
        value: value,
    });
});
var ConfigEditor = /** @class */ (function (_super) {
    __extends(ConfigEditor, _super);
    function ConfigEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.renderTypeHelp = function () {
            return (React.createElement("p", null,
                "There are different types of Graphite compatible backends. Here you can specify the type you are using. If you are using",
                ' ',
                React.createElement("a", { href: "https://github.com/grafana/metrictank", className: "pointer", target: "_blank", rel: "noreferrer" }, "Metrictank"),
                ' ',
                "then select that here. This will enable Metrictank specific features like query processing meta data. Metrictank is a multi-tenant timeseries engine for Graphite and friends."));
        };
        _this.state = {
            showMappingsHelp: store.getObject(SHOW_MAPPINGS_HELP_KEY, true),
        };
        return _this;
    }
    ConfigEditor.prototype.componentDidMount = function () {
        updateDatasourcePluginJsonDataOption(this.props, 'graphiteVersion', this.currentGraphiteVersion);
    };
    ConfigEditor.prototype.render = function () {
        var _this = this;
        var _a, _b;
        var _c = this.props, options = _c.options, onOptionsChange = _c.onOptionsChange;
        var currentVersion = graphiteVersions.find(function (item) { return item.value === _this.currentGraphiteVersion; });
        return (React.createElement(React.Fragment, null,
            options.access === 'direct' && (React.createElement(Alert, { title: "Deprecation Notice", severity: "warning" }, "This data source uses browser access mode. This mode is deprecated and will be removed in the future. Please use server access mode instead.")),
            React.createElement(DataSourceHttpSettings, { defaultUrl: "http://localhost:8080", dataSourceConfig: options, onChange: onOptionsChange }),
            React.createElement("h3", { className: "page-heading" }, "Graphite details"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(InlineFormLabel, { tooltip: "This option controls what functions are available in the Graphite query editor." }, "Version"),
                        React.createElement(Select, { menuShouldPortal: true, value: currentVersion, options: graphiteVersions, width: 8, onChange: onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteVersion') }))),
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(InlineFormLabel, { tooltip: this.renderTypeHelp }, "Type"),
                        React.createElement(Select, { menuShouldPortal: true, options: graphiteTypes, value: graphiteTypes.find(function (type) { return type.value === options.jsonData.graphiteType; }), width: 8, onChange: onUpdateDatasourceJsonDataOptionSelect(this.props, 'graphiteType') }))),
                options.jsonData.graphiteType === GraphiteType.Metrictank && (React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(Switch, { label: "Rollup indicator", labelClass: 'width-10', tooltip: "Shows up as an info icon in panel headers when data is aggregated", checked: !!options.jsonData.rollupIndicatorEnabled, onChange: onUpdateDatasourceJsonDataOptionChecked(this.props, 'rollupIndicatorEnabled') }))))),
            React.createElement(MappingsConfiguration, { mappings: (((_b = (_a = options.jsonData.importConfiguration) === null || _a === void 0 ? void 0 : _a.loki) === null || _b === void 0 ? void 0 : _b.mappings) || []).map(toString), showHelp: this.state.showMappingsHelp, onDismiss: function () {
                    _this.setState({ showMappingsHelp: false });
                    store.setObject(SHOW_MAPPINGS_HELP_KEY, false);
                }, onRestoreHelp: function () {
                    _this.setState({ showMappingsHelp: true });
                    store.setObject(SHOW_MAPPINGS_HELP_KEY, true);
                }, onChange: function (mappings) {
                    onOptionsChange(__assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { importConfiguration: __assign(__assign({}, options.jsonData.importConfiguration), { loki: {
                                    mappings: mappings.map(fromString),
                                } }) }) }));
                } })));
    };
    Object.defineProperty(ConfigEditor.prototype, "currentGraphiteVersion", {
        get: function () {
            return this.props.options.jsonData.graphiteVersion || DEFAULT_GRAPHITE_VERSION;
        },
        enumerable: false,
        configurable: true
    });
    return ConfigEditor;
}(PureComponent));
export { ConfigEditor };
//# sourceMappingURL=ConfigEditor.js.map