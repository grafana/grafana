import React, { ComponentProps } from 'react';

import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel, SceneObjectRef } from '@grafana/scenes';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';

import { DashboardScene } from '../scene/DashboardScene';
import { getDashboardSceneFor } from '../utils/utils';

import { ShareLinkTab } from './ShareLinkTab';
import { ShareSnapshotTab } from './ShareSnapshotTab';
import { SceneShareTab } from './types';

interface SharePanelModalState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  panelRef?: SceneObjectRef<VizPanel>;
  tabs?: SceneShareTab[];
  activeTab: string;
}

export class SharePanelModal extends SceneObjectBase<SharePanelModalState> {
  static Component = SharePanelModalRenderer;

  constructor(state: Omit<SharePanelModalState, 'activeTab'>) {
    super({
      ...state,
      activeTab: 'Link',
    });

    this.addActivationHandler(() => this.buildTabs());
  }

  private buildTabs() {
    const { dashboardRef, panelRef } = this.state;

    const tabs: SceneShareTab[] = [new ShareLinkTab({ dashboardRef, panelRef })];

    if (contextSrv.isSignedIn && config.snapshotEnabled) {
      tabs.push(new ShareSnapshotTab({ panelRef }));
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

    // const at = tabs.find((t) => t.value === activeTab);

    // return {
    //   tabs,
    //   activeTab: at?.value ?? tabs[0].value,
    // };
  }

  onClose = () => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.closeModal();
  };

  onChangeTab: ComponentProps<typeof ModalTabsHeader>['onChangeTab'] = (tab) => {
    this.setState({ activeTab: tab.value });
  };
}

function SharePanelModalRenderer({ model }: SceneComponentProps<SharePanelModal>) {
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
    <Modal isOpen={true} title={header} onDismiss={model.onClose}>
      <TabContent>{currentTab && <currentTab.Component model={currentTab} />}</TabContent>
    </Modal>
  );
}
