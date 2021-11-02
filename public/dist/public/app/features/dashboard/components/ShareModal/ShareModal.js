import { __extends, __read, __spreadArray } from "tslib";
import React from 'react';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { ShareLink } from './ShareLink';
import { ShareSnapshot } from './ShareSnapshot';
import { ShareExport } from './ShareExport';
import { ShareEmbed } from './ShareEmbed';
import { contextSrv } from 'app/core/core';
import { ShareLibraryPanel } from './ShareLibraryPanel';
var customDashboardTabs = [];
var customPanelTabs = [];
export function addDashboardShareTab(tab) {
    customDashboardTabs.push(tab);
}
export function addPanelShareTab(tab) {
    customPanelTabs.push(tab);
}
function getInitialState(props) {
    var tabs = getTabs(props);
    return {
        tabs: tabs,
        activeTab: tabs[0].value,
    };
}
function getTabs(props) {
    var panel = props.panel;
    var tabs = [{ label: 'Link', value: 'link', component: ShareLink }];
    if (contextSrv.isSignedIn) {
        tabs.push({ label: 'Snapshot', value: 'snapshot', component: ShareSnapshot });
    }
    if (panel) {
        tabs.push({ label: 'Embed', value: 'embed', component: ShareEmbed });
        if (!isPanelModelLibraryPanel(panel)) {
            tabs.push({ label: 'Library panel', value: 'library_panel', component: ShareLibraryPanel });
        }
        tabs.push.apply(tabs, __spreadArray([], __read(customPanelTabs), false));
    }
    else {
        tabs.push({ label: 'Export', value: 'export', component: ShareExport });
        tabs.push.apply(tabs, __spreadArray([], __read(customDashboardTabs), false));
    }
    return tabs;
}
var ShareModal = /** @class */ (function (_super) {
    __extends(ShareModal, _super);
    function ShareModal(props) {
        var _this = _super.call(this, props) || this;
        // onDismiss = () => {
        //   //this.setState(getInitialState(this.props));
        //   this.props.onDismiss();
        // };
        _this.onSelectTab = function (t) {
            _this.setState({ activeTab: t.value });
        };
        _this.state = getInitialState(props);
        return _this;
    }
    ShareModal.prototype.getTabs = function () {
        return getTabs(this.props);
    };
    ShareModal.prototype.getActiveTab = function () {
        var _a = this.state, tabs = _a.tabs, activeTab = _a.activeTab;
        return tabs.find(function (t) { return t.value === activeTab; });
    };
    ShareModal.prototype.renderTitle = function () {
        var panel = this.props.panel;
        var activeTab = this.state.activeTab;
        var title = panel ? 'Share Panel' : 'Share';
        var tabs = this.getTabs();
        return (React.createElement(ModalTabsHeader, { title: title, icon: "share-alt", tabs: tabs, activeTab: activeTab, onChangeTab: this.onSelectTab }));
    };
    ShareModal.prototype.render = function () {
        var _a = this.props, dashboard = _a.dashboard, panel = _a.panel;
        var activeTabModel = this.getActiveTab();
        var ActiveTab = activeTabModel.component;
        return (React.createElement(Modal, { isOpen: true, title: this.renderTitle(), onDismiss: this.props.onDismiss },
            React.createElement(TabContent, null,
                React.createElement(ActiveTab, { dashboard: dashboard, panel: panel, onDismiss: this.props.onDismiss }))));
    };
    return ShareModal;
}(React.Component));
export { ShareModal };
//# sourceMappingURL=ShareModal.js.map