import * as tslib_1 from "tslib";
// Libraries
import React from 'react';
import _ from 'lodash';
// Utils
import config from 'app/core/config';
import store from 'app/core/store';
// Store
import { store as reduxStore } from 'app/store/store';
import { updateLocation } from 'app/core/actions';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
var AddPanelWidget = /** @class */ (function (_super) {
    tslib_1.__extends(AddPanelWidget, _super);
    function AddPanelWidget(props) {
        var _this = _super.call(this, props) || this;
        _this.onCreateNewPanel = function (tab) {
            if (tab === void 0) { tab = 'queries'; }
            var dashboard = _this.props.dashboard;
            var gridPos = _this.props.panel.gridPos;
            var newPanel = {
                type: 'graph',
                title: 'Panel Title',
                gridPos: { x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h },
            };
            dashboard.addPanel(newPanel);
            dashboard.removePanel(_this.props.panel);
            var location = {
                query: {
                    panelId: newPanel.id,
                    edit: true,
                    fullscreen: true,
                },
                partial: true,
            };
            if (tab === 'visualization') {
                location.query.tab = 'visualization';
                location.query.openVizPicker = true;
            }
            reduxStore.dispatch(updateLocation(location));
        };
        _this.onPasteCopiedPanel = function (panelPluginInfo) {
            var dashboard = _this.props.dashboard;
            var gridPos = _this.props.panel.gridPos;
            var newPanel = {
                type: panelPluginInfo.id,
                title: 'Panel Title',
                gridPos: {
                    x: gridPos.x,
                    y: gridPos.y,
                    w: panelPluginInfo.defaults.gridPos.w,
                    h: panelPluginInfo.defaults.gridPos.h,
                },
            };
            // apply panel template / defaults
            if (panelPluginInfo.defaults) {
                _.defaults(newPanel, panelPluginInfo.defaults);
                newPanel.title = panelPluginInfo.defaults.title;
                store.delete(LS_PANEL_COPY_KEY);
            }
            dashboard.addPanel(newPanel);
            dashboard.removePanel(_this.props.panel);
        };
        _this.onCreateNewRow = function () {
            var dashboard = _this.props.dashboard;
            var newRow = {
                type: 'row',
                title: 'Row title',
                gridPos: { x: 0, y: 0 },
            };
            dashboard.addPanel(newRow);
            dashboard.removePanel(_this.props.panel);
        };
        _this.renderOptionLink = function (icon, text, onClick) {
            return (React.createElement("div", null,
                React.createElement("a", { href: "#", onClick: onClick, className: "add-panel-widget__link btn btn-inverse" },
                    React.createElement("div", { className: "add-panel-widget__icon" },
                        React.createElement("i", { className: "gicon gicon-" + icon })),
                    React.createElement("span", null, text))));
        };
        _this.handleCloseAddPanel = _this.handleCloseAddPanel.bind(_this);
        _this.state = {
            copiedPanelPlugins: _this.getCopiedPanelPlugins(),
        };
        return _this;
    }
    AddPanelWidget.prototype.getCopiedPanelPlugins = function () {
        var panels = _.chain(config.panels)
            .filter({ hideFromList: false })
            .map(function (item) { return item; })
            .value();
        var copiedPanels = [];
        var copiedPanelJson = store.get(LS_PANEL_COPY_KEY);
        if (copiedPanelJson) {
            var copiedPanel = JSON.parse(copiedPanelJson);
            var pluginInfo = _.find(panels, { id: copiedPanel.type });
            if (pluginInfo) {
                var pluginCopy = _.cloneDeep(pluginInfo);
                pluginCopy.name = copiedPanel.title;
                pluginCopy.sort = -1;
                pluginCopy.defaults = copiedPanel;
                copiedPanels.push(pluginCopy);
            }
        }
        return _.sortBy(copiedPanels, 'sort');
    };
    AddPanelWidget.prototype.handleCloseAddPanel = function (evt) {
        evt.preventDefault();
        this.props.dashboard.removePanel(this.props.dashboard.panels[0]);
    };
    AddPanelWidget.prototype.render = function () {
        var _this = this;
        var copiedPanelPlugins = this.state.copiedPanelPlugins;
        return (React.createElement("div", { className: "panel-container add-panel-widget-container" },
            React.createElement("div", { className: "add-panel-widget" },
                React.createElement("div", { className: "add-panel-widget__header grid-drag-handle" },
                    React.createElement("i", { className: "gicon gicon-add-panel" }),
                    React.createElement("span", { className: "add-panel-widget__title" }, "New Panel"),
                    React.createElement("button", { className: "add-panel-widget__close", onClick: this.handleCloseAddPanel },
                        React.createElement("i", { className: "fa fa-close" }))),
                React.createElement("div", { className: "add-panel-widget__btn-container" },
                    React.createElement("div", { className: "add-panel-widget__create" },
                        this.renderOptionLink('queries', 'Add Query', this.onCreateNewPanel),
                        this.renderOptionLink('visualization', 'Choose Visualization', function () {
                            return _this.onCreateNewPanel('visualization');
                        })),
                    React.createElement("div", { className: "add-panel-widget__actions" },
                        React.createElement("button", { className: "btn btn-inverse add-panel-widget__action", onClick: this.onCreateNewRow }, "Convert to row"),
                        copiedPanelPlugins.length === 1 && (React.createElement("button", { className: "btn btn-inverse add-panel-widget__action", onClick: function () { return _this.onPasteCopiedPanel(copiedPanelPlugins[0]); } }, "Paste copied panel")))))));
    };
    return AddPanelWidget;
}(React.Component));
export { AddPanelWidget };
//# sourceMappingURL=AddPanelWidget.js.map