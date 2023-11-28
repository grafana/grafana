import { css } from '@emotion/css';
import React, { useEffect, useCallback } from 'react';
import { Subscription } from 'rxjs';
import { config, reportInteraction } from '@grafana/runtime';
import { Tab, TabContent, TabsBar, toIconName, useForceUpdate, useStyles2 } from '@grafana/ui';
import AlertTabIndex from 'app/features/alerting/AlertTabIndex';
import { PanelAlertTab } from 'app/features/alerting/unified/PanelAlertTab';
import { PanelQueriesChangedEvent, PanelTransformationsChangedEvent } from 'app/types/events';
import { TransformationsEditor } from '../TransformationsEditor/TransformationsEditor';
import { PanelEditorQueries } from './PanelEditorQueries';
import { PanelEditorTabId } from './types';
export const PanelEditorTabs = React.memo(({ panel, dashboard, tabs, onChangeTab }) => {
    const forceUpdate = useForceUpdate();
    const styles = useStyles2(getStyles);
    const instrumentedOnChangeTab = useCallback((tab) => {
        let eventName = 'panel_editor_tabs_changed';
        if (config.featureToggles.transformationsRedesign) {
            eventName = 'transformations_redesign_' + eventName;
        }
        if (!tab.active) {
            reportInteraction(eventName, { tab_id: tab.id });
        }
        onChangeTab(tab);
    }, [onChangeTab]);
    useEffect(() => {
        const eventSubs = new Subscription();
        eventSubs.add(panel.events.subscribe(PanelQueriesChangedEvent, forceUpdate));
        eventSubs.add(panel.events.subscribe(PanelTransformationsChangedEvent, forceUpdate));
        return () => eventSubs.unsubscribe();
    }, [panel, dashboard, forceUpdate]);
    const activeTab = tabs.find((item) => item.active);
    if (tabs.length === 0) {
        return null;
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(TabsBar, { className: styles.tabBar, hideBorder: true }, tabs.map((tab) => {
            if (tab.id === PanelEditorTabId.Alert) {
                return renderAlertTab(tab, panel, dashboard, instrumentedOnChangeTab);
            }
            return (React.createElement(Tab, { key: tab.id, label: tab.text, active: tab.active, onChangeTab: () => instrumentedOnChangeTab(tab), icon: toIconName(tab.icon), counter: getCounter(panel, tab) }));
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
            const transformations = (_a = panel.getTransformations()) !== null && _a !== void 0 ? _a : [];
            return transformations.length;
    }
    return null;
}
function renderAlertTab(tab, panel, dashboard, onChangeTab) {
    const alertingDisabled = !config.alertingEnabled && !config.unifiedAlertingEnabled;
    if (alertingDisabled) {
        return null;
    }
    if (config.unifiedAlertingEnabled) {
        return (React.createElement(PanelAlertTab, { key: tab.id, label: tab.text, active: tab.active, onChangeTab: () => onChangeTab(tab), icon: toIconName(tab.icon), panel: panel, dashboard: dashboard }));
    }
    if (config.alertingEnabled) {
        return (React.createElement(Tab, { key: tab.id, label: tab.text, active: tab.active, onChangeTab: () => onChangeTab(tab), icon: toIconName(tab.icon), counter: getCounter(panel, tab) }));
    }
    return null;
}
const getStyles = (theme) => {
    return {
        wrapper: css `
      display: flex;
      flex-direction: column;
      height: 100%;
    `,
        tabBar: css `
      padding-left: ${theme.spacing(2)};
    `,
        tabContent: css `
      padding: 0;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.components.panel.borderColor};
      border-left: none;
      border-bottom: none;
      border-top-right-radius: ${theme.shape.borderRadius(1.5)};
    `,
    };
};
//# sourceMappingURL=PanelEditorTabs.js.map