import * as tslib_1 from "tslib";
var _a;
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { QueriesTab } from './QueriesTab';
import VisualizationTab from './VisualizationTab';
import { GeneralTab } from './GeneralTab';
import { AlertTab } from '../../alerting/AlertTab';
import config from 'app/core/config';
import { store } from 'app/store/store';
import { updateLocation } from 'app/core/actions';
import { Tooltip } from '@grafana/ui';
var PanelEditorTabIds;
(function (PanelEditorTabIds) {
    PanelEditorTabIds["Queries"] = "queries";
    PanelEditorTabIds["Visualization"] = "visualization";
    PanelEditorTabIds["Advanced"] = "advanced";
    PanelEditorTabIds["Alert"] = "alert";
})(PanelEditorTabIds || (PanelEditorTabIds = {}));
var panelEditorTabTexts = (_a = {},
    _a[PanelEditorTabIds.Queries] = 'Queries',
    _a[PanelEditorTabIds.Visualization] = 'Visualization',
    _a[PanelEditorTabIds.Advanced] = 'General',
    _a[PanelEditorTabIds.Alert] = 'Alert',
    _a);
var getPanelEditorTab = function (tabId) {
    return {
        id: tabId,
        text: panelEditorTabTexts[tabId],
    };
};
var PanelEditor = /** @class */ (function (_super) {
    tslib_1.__extends(PanelEditor, _super);
    function PanelEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.onChangeTab = function (tab) {
            store.dispatch(updateLocation({
                query: { tab: tab.id, openVizPicker: null },
                partial: true,
            }));
            _this.forceUpdate();
        };
        return _this;
    }
    PanelEditor.prototype.renderCurrentTab = function (activeTab) {
        var _a = this.props, panel = _a.panel, dashboard = _a.dashboard, onTypeChanged = _a.onTypeChanged, plugin = _a.plugin, angularPanel = _a.angularPanel;
        switch (activeTab) {
            case 'advanced':
                return React.createElement(GeneralTab, { panel: panel });
            case 'queries':
                return React.createElement(QueriesTab, { panel: panel, dashboard: dashboard });
            case 'alert':
                return React.createElement(AlertTab, { angularPanel: angularPanel, dashboard: dashboard, panel: panel });
            case 'visualization':
                return (React.createElement(VisualizationTab, { panel: panel, dashboard: dashboard, plugin: plugin, onTypeChanged: onTypeChanged, angularPanel: angularPanel }));
            default:
                return null;
        }
    };
    PanelEditor.prototype.render = function () {
        var _this = this;
        var plugin = this.props.plugin;
        var activeTab = store.getState().location.query.tab || PanelEditorTabIds.Queries;
        var tabs = [
            getPanelEditorTab(PanelEditorTabIds.Queries),
            getPanelEditorTab(PanelEditorTabIds.Visualization),
            getPanelEditorTab(PanelEditorTabIds.Advanced),
        ];
        // handle panels that do not have queries tab
        if (plugin.dataFormats.length === 0) {
            // remove queries tab
            tabs.shift();
            // switch tab
            if (activeTab === PanelEditorTabIds.Queries) {
                activeTab = PanelEditorTabIds.Visualization;
            }
        }
        if (config.alertingEnabled && plugin.id === 'graph') {
            tabs.push(getPanelEditorTab(PanelEditorTabIds.Alert));
        }
        return (React.createElement("div", { className: "panel-editor-container__editor" },
            React.createElement("div", { className: "panel-editor-tabs" }, tabs.map(function (tab) {
                return React.createElement(TabItem, { tab: tab, activeTab: activeTab, onClick: _this.onChangeTab, key: tab.id });
            })),
            React.createElement("div", { className: "panel-editor__right" }, this.renderCurrentTab(activeTab))));
    };
    return PanelEditor;
}(PureComponent));
export { PanelEditor };
function TabItem(_a) {
    var tab = _a.tab, activeTab = _a.activeTab, onClick = _a.onClick;
    var tabClasses = classNames({
        'panel-editor-tabs__link': true,
        active: activeTab === tab.id,
    });
    return (React.createElement("div", { className: "panel-editor-tabs__item", onClick: function () { return onClick(tab); } },
        React.createElement("a", { className: tabClasses },
            React.createElement(Tooltip, { content: "" + tab.text, placement: "auto" },
                React.createElement("i", { className: "gicon gicon-" + tab.id + (activeTab === tab.id ? '-active' : '') })))));
}
//# sourceMappingURL=PanelEditor.js.map