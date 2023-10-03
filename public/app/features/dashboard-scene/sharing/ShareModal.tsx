import React, { ComponentProps } from 'react';

import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel, SceneObjectRef } from '@grafana/scenes';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';

import { DashboardScene } from '../scene/DashboardScene';
import { getDashboardSceneFor } from '../utils/utils';

import { ShareExportTab } from './ShareExportTab';
import { ShareLinkTab } from './ShareLinkTab';
import { ShareSnapshotTab } from './ShareSnapshotTab';
import { ModalSceneObjectLike, SceneShareTab } from './types';

interface ShareModalState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  panelRef?: SceneObjectRef<VizPanel>;
  tabs?: SceneShareTab[];
  activeTab: string;
}

/**
 * Used for full dashboard share modal and the panel level share modal
 */
export class ShareModal extends SceneObjectBase<ShareModalState> implements ModalSceneObjectLike {
  static Component = SharePanelModalRenderer;

  constructor(state: Omit<ShareModalState, 'activeTab'>) {
    super({
      ...state,
      activeTab: 'Link',
    });

    this.addActivationHandler(() => this.buildTabs());
  }

  private buildTabs() {
    const { dashboardRef, panelRef } = this.state;

    const tabs: SceneShareTab[] = [new ShareLinkTab({ dashboardRef, panelRef, modalRef: this.getRef() })];

    if (!panelRef) {
      tabs.push(new ShareExportTab({ dashboardRef, modalRef: this.getRef() }));
    }

    if (contextSrv.isSignedIn && config.snapshotEnabled) {
      tabs.push(new ShareSnapshotTab({ panelRef, modalRef: this.getRef() }));
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

  onDismiss = () => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.closeModal();
  };

  onChangeTab: ComponentProps<typeof ModalTabsHeader>['onChangeTab'] = (tab) => {
    this.setState({ activeTab: tab.value });
  };
}

function SharePanelModalRenderer({ model }: SceneComponentProps<ShareModal>) {
  const { panelRef, tabs, activeTab } = model.useState();
  const title = panelRef ? t('share-modal.panel.title', 'Share Panel') : t('share-modal.dashboard.title', 'Share');

  if (!tabs) {
    return;
  }

  const modalTabs = tabs?.map((tab) => ({
    label: tab.getTabLabel(),
    value: tab.getTabLabel(),
  }));

  const header = (
    <ModalTabsHeader
      title={title}
      icon="share-alt"
      tabs={modalTabs}
      activeTab={activeTab}
      onChangeTab={model.onChangeTab}
    />
  );

  const currentTab = tabs.find((t) => t.getTabLabel() === activeTab);

  return (
    <Modal isOpen={true} title={header} onDismiss={model.onDismiss}>
      <TabContent>{currentTab && <currentTab.Component model={currentTab} />}</TabContent>
    </Modal>
  );
}
