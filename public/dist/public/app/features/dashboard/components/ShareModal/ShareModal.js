import React from 'react';
import { Modal, ModalTabsHeader, TabContent, withTheme2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { SharePublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboard';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { ShareEmbed } from './ShareEmbed';
import { ShareExport } from './ShareExport';
import { ShareLibraryPanel } from './ShareLibraryPanel';
import { ShareLink } from './ShareLink';
import { ShareSnapshot } from './ShareSnapshot';
import { trackDashboardSharingTypeOpen } from './analytics';
import { shareDashboardType } from './utils';
const customDashboardTabs = [];
const customPanelTabs = [];
export function addDashboardShareTab(tab) {
    customDashboardTabs.push(tab);
}
export function addPanelShareTab(tab) {
    customPanelTabs.push(tab);
}
function getTabs(panel, activeTab) {
    var _a;
    const linkLabel = t('share-modal.tab-title.link', 'Link');
    const tabs = [{ label: linkLabel, value: shareDashboardType.link, component: ShareLink }];
    if (contextSrv.isSignedIn && config.snapshotEnabled) {
        const snapshotLabel = t('share-modal.tab-title.snapshot', 'Snapshot');
        tabs.push({ label: snapshotLabel, value: shareDashboardType.snapshot, component: ShareSnapshot });
    }
    if (panel) {
        const embedLabel = t('share-modal.tab-title.embed', 'Embed');
        tabs.push({ label: embedLabel, value: shareDashboardType.embed, component: ShareEmbed });
        if (!isPanelModelLibraryPanel(panel)) {
            const libraryPanelLabel = t('share-modal.tab-title.library-panel', 'Library panel');
            tabs.push({ label: libraryPanelLabel, value: shareDashboardType.libraryPanel, component: ShareLibraryPanel });
        }
        tabs.push(...customPanelTabs);
    }
    else {
        const exportLabel = t('share-modal.tab-title.export', 'Export');
        tabs.push({
            label: exportLabel,
            value: shareDashboardType.export,
            component: ShareExport,
        });
        tabs.push(...customDashboardTabs);
    }
    if (Boolean(config.featureToggles['publicDashboards'])) {
        tabs.push({
            label: 'Public dashboard',
            value: shareDashboardType.publicDashboard,
            component: SharePublicDashboard,
        });
    }
    const at = tabs.find((t) => t.value === activeTab);
    return {
        tabs,
        activeTab: (_a = at === null || at === void 0 ? void 0 : at.value) !== null && _a !== void 0 ? _a : tabs[0].value,
    };
}
function getInitialState(props) {
    const { tabs, activeTab } = getTabs(props.panel, props.activeTab);
    return {
        tabs,
        activeTab,
    };
}
class UnthemedShareModal extends React.Component {
    constructor(props) {
        super(props);
        this.onSelectTab = (t) => {
            this.setState((prevState) => (Object.assign(Object.assign({}, prevState), { activeTab: t.value })));
            trackDashboardSharingTypeOpen(t.value);
        };
        this.state = getInitialState(props);
    }
    getActiveTab() {
        const { tabs, activeTab } = this.state;
        return tabs.find((t) => t.value === activeTab);
    }
    renderTitle() {
        const { panel } = this.props;
        const { activeTab } = this.state;
        const title = panel ? t('share-modal.panel.title', 'Share Panel') : t('share-modal.dashboard.title', 'Share');
        const tabs = getTabs(this.props.panel, this.state.activeTab).tabs;
        return (React.createElement(ModalTabsHeader, { title: title, icon: "share-alt", tabs: tabs, activeTab: activeTab, onChangeTab: this.onSelectTab }));
    }
    render() {
        const { dashboard, panel } = this.props;
        const activeTabModel = this.getActiveTab();
        const ActiveTab = activeTabModel.component;
        return (React.createElement(Modal, { isOpen: true, title: this.renderTitle(), onDismiss: this.props.onDismiss, className: "share-modal" },
            React.createElement(TabContent, null,
                React.createElement(ActiveTab, { dashboard: dashboard, panel: panel, onDismiss: this.props.onDismiss }))));
    }
}
export const ShareModal = withTheme2(UnthemedShareModal);
//# sourceMappingURL=ShareModal.js.map