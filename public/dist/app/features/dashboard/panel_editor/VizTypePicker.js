import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import config from 'app/core/config';
import VizTypePickerPlugin from './VizTypePickerPlugin';
import { EmptySearchResult } from '@grafana/ui';
var VizTypePicker = /** @class */ (function (_super) {
    tslib_1.__extends(VizTypePicker, _super);
    function VizTypePicker(props) {
        var _this = _super.call(this, props) || this;
        _this.pluginList = _this.getPanelPlugins;
        _this.renderVizPlugin = function (plugin, index) {
            var onTypeChanged = _this.props.onTypeChanged;
            var isCurrent = plugin.id === _this.props.current.id;
            return (React.createElement(VizTypePickerPlugin, { key: plugin.id, isCurrent: isCurrent, plugin: plugin, onClick: function () { return onTypeChanged(plugin); } }));
        };
        _this.getFilteredPluginList = function () {
            var searchQuery = _this.props.searchQuery;
            var regex = new RegExp(searchQuery, 'i');
            var pluginList = _this.pluginList;
            var filtered = pluginList.filter(function (item) {
                return regex.test(item.name);
            });
            return filtered;
        };
        return _this;
    }
    Object.defineProperty(VizTypePicker.prototype, "maxSelectedIndex", {
        get: function () {
            var filteredPluginList = this.getFilteredPluginList();
            return filteredPluginList.length - 1;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(VizTypePicker.prototype, "getPanelPlugins", {
        get: function () {
            var allPanels = config.panels;
            return Object.keys(allPanels)
                .filter(function (key) { return allPanels[key]['hideFromList'] === false; })
                .map(function (key) { return allPanels[key]; })
                .sort(function (a, b) { return a.sort - b.sort; });
        },
        enumerable: true,
        configurable: true
    });
    VizTypePicker.prototype.render = function () {
        var _this = this;
        var filteredPluginList = this.getFilteredPluginList();
        var hasResults = filteredPluginList.length > 0;
        return (React.createElement("div", { className: "viz-picker" },
            React.createElement("div", { className: "viz-picker-list" }, hasResults ? (filteredPluginList.map(function (plugin, index) { return _this.renderVizPlugin(plugin, index); })) : (React.createElement(EmptySearchResult, null, "Could not find anything matching your query")))));
    };
    return VizTypePicker;
}(PureComponent));
export { VizTypePicker };
//# sourceMappingURL=VizTypePicker.js.map