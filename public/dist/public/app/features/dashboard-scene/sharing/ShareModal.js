import React from 'react';
import { config } from '@grafana/runtime';
import { SceneObjectBase } from '@grafana/scenes';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { getDashboardSceneFor } from '../utils/utils';
import { ShareExportTab } from './ShareExportTab';
import { ShareLinkTab } from './ShareLinkTab';
import { ShareSnapshotTab } from './ShareSnapshotTab';
/**
 * Used for full dashboard share modal and the panel level share modal
 */
export class ShareModal extends SceneObjectBase {
    constructor(state) {
        super(Object.assign(Object.assign({}, state), { activeTab: 'Link' }));
        this.onDismiss = () => {
            const dashboard = getDashboardSceneFor(this);
            dashboard.closeModal();
        };
        this.onChangeTab = (tab) => {
            this.setState({ activeTab: tab.value });
        };
        this.addActivationHandler(() => this.buildTabs());
    }
    buildTabs() {
        const { dashboardRef, panelRef } = this.state;
        const tabs = [new ShareLinkTab({ dashboardRef, panelRef, modalRef: this.getRef() })];
        if (!panelRef) {
            tabs.push(new ShareExportTab({ dashboardRef, modalRef: this.getRef() }));
        }
        if (contextSrv.isSignedIn && config.snapshotEnabled) {
            tabs.push(new ShareSnapshotTab({ panelRef, dashboardRef, modalRef: this.getRef() }));
        }
        this.setState({ tabs });
        // if (panel) {
        //   const embedLabel = t('share-modal.tab-title.embed', 'Embed');
        //   tabs.push({ label: embedLabel, value: shareDashboardType.embed, component: ShareEmbed });
        //   if (!isPanelModelLibraryPanel(panel)) {
        //     const libraryPanelLabel = t('share-modal.tab-title.library-panel', 'Library panel');
        //     tabs.push({ label: libraryPanelLabel, value: shareDashboardType.libraryPanel, component: ShareLibraryPanel });
        //   }
        //   tabs.push(...customPanelTabs);
        // } else {
        //   const exportLabel = t('share-modal.tab-title.export', 'Export');
        //   tabs.push({
        //     label: exportLabel,
        //     value: shareDashboardType.export,
        //     component: ShareExport,
        //   });
        //   tabs.push(...customDashboardTabs);
        // }
        // if (Boolean(config.featureToggles['publicDashboards'])) {
        //   tabs.push({
        //     label: 'Public dashboard',
        //     value: shareDashboardType.publicDashboard,
        //     component: SharePublicDashboard,
        //   });
        // }
    }
}
ShareModal.Component = SharePanelModalRenderer;
function SharePanelModalRenderer({ model }) {
    const { panelRef, tabs, activeTab } = model.useState();
    const title = panelRef ? t('share-modal.panel.title', 'Share Panel') : t('share-modal.dashboard.title', 'Share');
    if (!tabs) {
        return;
    }
    const modalTabs = tabs === null || tabs === void 0 ? void 0 : tabs.map((tab) => ({
        label: tab.getTabLabel(),
        value: tab.getTabLabel(),
    }));
    const header = (React.createElement(ModalTabsHeader, { title: title, icon: "share-alt", tabs: modalTabs, activeTab: activeTab, onChangeTab: model.onChangeTab }));
    const currentTab = tabs.find((t) => t.getTabLabel() === activeTab);
    return (React.createElement(Modal, { isOpen: true, title: header, onDismiss: model.onDismiss },
        React.createElement(TabContent, null, currentTab && React.createElement(currentTab.Component, { model: currentTab }))));
}
//# sourceMappingURL=ShareModal.js.map