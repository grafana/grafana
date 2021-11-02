import { __extends } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Components
import { HorizontalGroup, PluginSignatureBadge, Select, stylesFactory } from '@grafana/ui';
import { getDataSourceUID, isUnsignedPluginSignature, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '../services/dataSourceSrv';
import { css, cx } from '@emotion/css';
/**
 * Component to be able to select a datasource from the list of installed and enabled
 * datasources in the current Grafana instance.
 *
 * @internal
 */
var DataSourcePicker = /** @class */ (function (_super) {
    __extends(DataSourcePicker, _super);
    function DataSourcePicker(props) {
        var _this = _super.call(this, props) || this;
        _this.dataSourceSrv = getDataSourceSrv();
        _this.state = {};
        _this.onChange = function (item) {
            var dsSettings = _this.dataSourceSrv.getInstanceSettings(item.value);
            if (dsSettings) {
                _this.props.onChange(dsSettings);
                _this.setState({ error: undefined });
            }
        };
        return _this;
    }
    DataSourcePicker.prototype.componentDidMount = function () {
        var current = this.props.current;
        var dsSettings = this.dataSourceSrv.getInstanceSettings(current);
        if (!dsSettings) {
            this.setState({ error: 'Could not find data source ' + current });
        }
    };
    DataSourcePicker.prototype.getCurrentValue = function () {
        var _a = this.props, current = _a.current, hideTextValue = _a.hideTextValue, noDefault = _a.noDefault;
        if (!current && noDefault) {
            return;
        }
        var ds = this.dataSourceSrv.getInstanceSettings(current);
        if (ds) {
            return {
                label: ds.name.substr(0, 37),
                value: ds.uid,
                imgUrl: ds.meta.info.logos.small,
                hideText: hideTextValue,
                meta: ds.meta,
            };
        }
        var uid = getDataSourceUID(current);
        return {
            label: (uid !== null && uid !== void 0 ? uid : 'no name') + ' - not found',
            value: uid !== null && uid !== void 0 ? uid : undefined,
            imgUrl: '',
            hideText: hideTextValue,
        };
    };
    DataSourcePicker.prototype.getDataSourceOptions = function () {
        var _a = this.props, alerting = _a.alerting, tracing = _a.tracing, metrics = _a.metrics, mixed = _a.mixed, dashboard = _a.dashboard, variables = _a.variables, annotations = _a.annotations, pluginId = _a.pluginId, type = _a.type, filter = _a.filter;
        var options = this.dataSourceSrv
            .getList({
            alerting: alerting,
            tracing: tracing,
            metrics: metrics,
            dashboard: dashboard,
            mixed: mixed,
            variables: variables,
            annotations: annotations,
            pluginId: pluginId,
            filter: filter,
            type: type,
        })
            .map(function (ds) { return ({
            value: ds.name,
            label: "" + ds.name + (ds.isDefault ? ' (default)' : ''),
            imgUrl: ds.meta.info.logos.small,
            meta: ds.meta,
        }); });
        return options;
    };
    DataSourcePicker.prototype.render = function () {
        var _a = this.props, autoFocus = _a.autoFocus, onBlur = _a.onBlur, openMenuOnFocus = _a.openMenuOnFocus, placeholder = _a.placeholder, width = _a.width;
        var error = this.state.error;
        var options = this.getDataSourceOptions();
        var value = this.getCurrentValue();
        var styles = getStyles();
        return (React.createElement("div", { "aria-label": selectors.components.DataSourcePicker.container },
            React.createElement(Select, { "aria-label": selectors.components.DataSourcePicker.inputV2, inputId: "data-source-picker", menuShouldPortal: true, className: styles.select, isMulti: false, isClearable: false, backspaceRemovesValue: false, onChange: this.onChange, options: options, autoFocus: autoFocus, onBlur: onBlur, width: width, openMenuOnFocus: openMenuOnFocus, maxMenuHeight: 500, placeholder: placeholder, noOptionsMessage: "No datasources found", value: value !== null && value !== void 0 ? value : null, invalid: !!error, getOptionLabel: function (o) {
                    if (o.meta && isUnsignedPluginSignature(o.meta.signature) && o !== value) {
                        return (React.createElement(HorizontalGroup, { align: "center", justify: "space-between" },
                            React.createElement("span", null, o.label),
                            " ",
                            React.createElement(PluginSignatureBadge, { status: o.meta.signature })));
                    }
                    return o.label || '';
                } })));
    };
    DataSourcePicker.defaultProps = {
        autoFocus: false,
        openMenuOnFocus: false,
        placeholder: 'Select data source',
    };
    return DataSourcePicker;
}(PureComponent));
export { DataSourcePicker };
var getStyles = stylesFactory(function () { return ({
    select: cx(css({
        minWidth: 200,
    }), 'ds-picker', 'select-container'),
}); });
//# sourceMappingURL=DataSourcePicker.js.map