import React, { useState } from 'react';
import { Tab, TabsBar } from '@grafana/ui/src';
import { InlineEditTabs } from '../../types';
export const TabsEditor = ({ onTabChange }) => {
    const [activeTab, setActiveTab] = useState(InlineEditTabs.SelectedElement);
    const tabs = [
        { label: 'Selected Element', value: InlineEditTabs.SelectedElement },
        { label: 'Element Management', value: InlineEditTabs.ElementManagement },
    ];
    const onCurrentTabChange = (value) => {
        onTabChange(value);
        setActiveTab(value);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(TabsBar, null, tabs.map((t, index) => (React.createElement(Tab, { key: `${t.value}-${index}`, label: t.label, active: t.value === activeTab, onChangeTab: () => onCurrentTabChange(t.value) }))))));
};
//# sourceMappingURL=TabsEditor.js.map