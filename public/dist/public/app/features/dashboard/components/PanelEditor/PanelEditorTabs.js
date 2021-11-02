import { __makeTemplateObject } from "tslib";
import React, { useEffect } from 'react';
import { css } from '@emotion/css';
import { Tab, TabContent, TabsBar, useForceUpdate, useStyles2 } from '@grafana/ui';
import { TransformationsEditor } from '../TransformationsEditor/TransformationsEditor';
import { PanelEditorTabId } from './types';
import { Subscription } from 'rxjs';
import { PanelQueriesChangedEvent, PanelTransformationsChangedEvent } from 'app/types/events';
import { PanelEditorQueries } from './PanelEditorQueries';
import { config } from '@grafana/runtime';
import AlertTabIndex from 'app/features/alerting/AlertTabIndex';
import { PanelAlertTab } from 'app/features/alerting/unified/PanelAlertTab';
export var PanelEditorTabs = React.memo(function (_a) {
    var panel = _a.panel, dashboard = _a.dashboard, tabs = _a.tabs, onChangeTab = _a.onChangeTab;
    var forceUpdate = useForceUpdate();
    var styles = useStyles2(getStyles);
    useEffect(function () {
        var eventSubs = new Subscription();
        eventSubs.add(panel.events.subscribe(PanelQueriesChangedEvent, forceUpdate));
        eventSubs.add(panel.events.subscribe(PanelTransformationsChangedEvent, forceUpdate));
        return function () { return eventSubs.unsubscribe(); };
    }, [panel, forceUpdate]);
    var activeTab = tabs.find(function (item) { return item.active; });
    if (tabs.length === 0) {
        return null;
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(TabsBar, { className: styles.tabBar, hideBorder: true }, tabs.map(function (tab) {
            if (config.unifiedAlertingEnabled && tab.id === PanelEditorTabId.Alert) {
                return (React.createElement(PanelAlertTab, { key: tab.id, label: tab.text, active: tab.active, onChangeTab: function () { return onChangeTab(tab); }, icon: tab.icon, panel: panel, dashboard: dashboard }));
            }
            return (React.createElement(Tab, { key: tab.id, label: tab.text, active: tab.active, onChangeTab: function () { return onChangeTab(tab); }, icon: tab.icon, counter: getCounter(panel, tab) }));
        })),
        React.createElement(TabContent, { className: styles.tabContent },
            activeTab.id === PanelEditorTabId.Query && React.createElement(PanelEditorQueries, { panel: panel, queries: panel.targets }),
            activeTab.id === PanelEditorTabId.Alert && React.createElement(AlertTabIndex, { panel: panel, dashboard: dashboard }),
            activeTab.id === PanelEditorTabId.Transform && React.createElement(TransformationsEditor, { panel: panel }))));
});
PanelEditorTabs.displayName = 'PanelEditorTabs';
function getCounter(panel, tab) {
    var _a;
    switch (tab.id) {
        case PanelEditorTabId.Query:
            return panel.targets.length;
        case PanelEditorTabId.Alert:
            return panel.alert ? 1 : 0;
        case PanelEditorTabId.Transform:
            var transformations = (_a = panel.getTransformations()) !== null && _a !== void 0 ? _a : [];
            return transformations.length;
    }
    return null;
}
var getStyles = function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n    "]))),
        tabBar: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      padding-left: ", ";\n    "], ["\n      padding-left: ", ";\n    "])), theme.spacing(2)),
        tabContent: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      padding: 0;\n      display: flex;\n      flex-direction: column;\n      flex-grow: 1;\n      min-height: 0;\n      background: ", ";\n      border: 1px solid ", ";\n      border-left: none;\n      border-bottom: none;\n      border-top-right-radius: ", ";\n    "], ["\n      padding: 0;\n      display: flex;\n      flex-direction: column;\n      flex-grow: 1;\n      min-height: 0;\n      background: ", ";\n      border: 1px solid ", ";\n      border-left: none;\n      border-bottom: none;\n      border-top-right-radius: ", ";\n    "])), theme.colors.background.primary, theme.components.panel.borderColor, theme.shape.borderRadius(1.5)),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=PanelEditorTabs.js.map