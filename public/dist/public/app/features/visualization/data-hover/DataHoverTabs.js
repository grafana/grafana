import React from 'react';
import { Tab, TabsBar } from '@grafana/ui';
export const DataHoverTabs = ({ layers, setActiveTabIndex, activeTabIndex }) => {
    return (React.createElement(TabsBar, null, layers &&
        layers.map((g, index) => (React.createElement(Tab, { key: index, label: g.layer.getName(), active: index === activeTabIndex, counter: g.features.length > 1 ? g.features.length : null, onChangeTab: () => {
                setActiveTabIndex(index);
            } })))));
};
//# sourceMappingURL=DataHoverTabs.js.map