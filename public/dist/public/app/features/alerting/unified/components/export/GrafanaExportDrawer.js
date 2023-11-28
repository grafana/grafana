import React from 'react';
import { Drawer } from '@grafana/ui';
import { RuleInspectorTabs } from '../rule-editor/RuleInspector';
export function GrafanaExportDrawer({ activeTab, onTabChange, children, onClose, formatProviders, title = 'Export', }) {
    const grafanaRulesTabs = Object.values(formatProviders).map((provider) => ({
        label: provider.name,
        value: provider.exportFormat,
    }));
    return (React.createElement(Drawer, { title: title, subtitle: "Select the format and download the file or copy the contents to clipboard", tabs: React.createElement(RuleInspectorTabs, { tabs: grafanaRulesTabs, setActiveTab: onTabChange, activeTab: activeTab }), onClose: onClose, size: "md" }, children));
}
//# sourceMappingURL=GrafanaExportDrawer.js.map