import React from 'react';
import { TabsBar } from '../Tabs/TabsBar';
import { Tab } from '../Tabs/Tab';
import { ModalHeader } from './ModalHeader';
export var ModalTabsHeader = function (_a) {
    var icon = _a.icon, title = _a.title, tabs = _a.tabs, activeTab = _a.activeTab, onChangeTab = _a.onChangeTab;
    return (React.createElement(ModalHeader, { icon: icon, title: title },
        React.createElement(TabsBar, { hideBorder: true }, tabs.map(function (t, index) {
            return (React.createElement(Tab, { key: t.value + "-" + index, label: t.label, icon: t.icon, active: t.value === activeTab, onChangeTab: function () { return onChangeTab(t); } }));
        }))));
};
//# sourceMappingURL=ModalTabsHeader.js.map