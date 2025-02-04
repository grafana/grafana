import { ComponentProps } from 'react';

import { config, locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { isPublicDashboardsEnabled } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { AccessControlAction } from 'app/types';

import { getTrackingSource } from '../../dashboard/components/ShareModal/utils';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor, isLibraryPanel } from '../utils/utils';

import { ShareExportTab } from './ShareExportTab';
import { ShareLibraryPanelTab } from './ShareLibraryPanelTab';
import { ShareLinkTab } from './ShareLinkTab';
import { SharePanelEmbedTab } from './SharePanelEmbedTab';
import { ShareSnapshotTab } from './ShareSnapshotTab';
import { SharePublicDashboardTab } from './public-dashboards/SharePublicDashboardTab';
import { ModalSceneObjectLike, SceneShareTab, SceneShareTabState } from './types';

interface ShareModalState extends SceneObjectState {
  panelRef?: SceneObjectRef<VizPanel>;
  tabs?: SceneShareTab[];
  activeTab: string;
}

type customDashboardTabType = new (...args: SceneShareTabState[]) => SceneShareTab;
const customDashboardTabs: customDashboardTabType[] = [];

export function addDashboardShareTab(tab: customDashboardTabType) {
  customDashboardTabs.push(tab);
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

    this.addActivationHandler(() => this.buildTabs(state.activeTab));
  }

  private buildTabs(activeTab?: string) {
    const { panelRef } = this.state;
    const modalRef = this.getRef();

    const tabs: SceneShareTab[] = [new ShareLinkTab({ panelRef, modalRef })];
    const dashboard = getDashboardSceneFor(this);

    if (!panelRef) {
      tabs.push(new ShareExportTab({ modalRef }));
    }

    if (
      contextSrv.isSignedIn &&
      config.snapshotEnabled &&
      contextSrv.hasPermission(AccessControlAction.SnapshotsCreate)
    ) {
      tabs.push(new ShareSnapshotTab({ panelRef, dashboardRef: dashboard.getRef(), modalRef }));
    }

    if (panelRef) {
      tabs.push(new SharePanelEmbedTab({ panelRef }));
      const panel = panelRef.resolve();
      if (panel instanceof VizPanel) {
        if (!isLibraryPanel(panel)) {
          tabs.push(new ShareLibraryPanelTab({ panelRef, modalRef }));
        }
      }
    }

    if (!panelRef) {
      tabs.push(...customDashboardTabs.map((Tab) => new Tab({ modalRef })));

      if (isPublicDashboardsEnabled()) {
        tabs.push(new SharePublicDashboardTab({ modalRef }));
      }
    }

    const at = tabs.find((t) => t.tabId === activeTab);

    this.setState({ activeTab: at?.tabId ?? tabs[0].tabId, tabs });
  }

  onDismiss = () => {
    if (this.state.panelRef) {
      const dashboard = getDashboardSceneFor(this);
      dashboard.closeModal();
    } else {
      locationService.partial({ shareView: null });
    }
  };

  onChangeTab: ComponentProps<typeof ModalTabsHeader>['onChangeTab'] = (tab) => {
    DashboardInteractions.sharingCategoryClicked({
      item: tab.value,
      shareResource: getTrackingSource(this.state.panelRef),
    });
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
