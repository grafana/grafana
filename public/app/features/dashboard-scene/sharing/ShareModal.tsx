import React, { ComponentProps } from 'react';

import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel, SceneObjectRef } from '@grafana/scenes';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { isPublicDashboardsEnabled } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { ShareExportTab } from './ShareExportTab';
import { ShareLibraryPanelTab } from './ShareLibraryPanelTab';
import { ShareLinkTab } from './ShareLinkTab';
import { SharePanelEmbedTab } from './SharePanelEmbedTab';
import { ShareSnapshotTab } from './ShareSnapshotTab';
import { SharePublicDashboardTab } from './public-dashboards/SharePublicDashboardTab';
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

  constructor(state: Omit<ShareModalState, 'activeTab'> & { activeTab?: string }) {
    super({
      activeTab: 'link',
      ...state,
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
      tabs.push(new ShareSnapshotTab({ panelRef, dashboardRef, modalRef: this.getRef() }));
    }

    if (panelRef) {
      tabs.push(new SharePanelEmbedTab({ panelRef, dashboardRef }));

      if (panelRef.resolve() instanceof VizPanel) {
        tabs.push(new ShareLibraryPanelTab({ panelRef, dashboardRef, modalRef: this.getRef() }));
      }
    }

    if (isPublicDashboardsEnabled()) {
      tabs.push(new SharePublicDashboardTab({ dashboardRef, modalRef: this.getRef() }));
    }

    this.setState({ tabs });
  }

  onDismiss = () => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.closeModal();
  };

  onChangeTab: ComponentProps<typeof ModalTabsHeader>['onChangeTab'] = (tab) => {
    DashboardInteractions.sharingTabChanged({ item: tab.value });
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
    value: tab.tabId,
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

  const currentTab = tabs.find((t) => t.tabId === activeTab);

  return (
    <Modal isOpen={true} title={header} onDismiss={model.onDismiss}>
      <TabContent>{currentTab && <currentTab.Component model={currentTab} />}</TabContent>
    </Modal>
  );
}
