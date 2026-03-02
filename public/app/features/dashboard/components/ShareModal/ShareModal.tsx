import * as React from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { SharePublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboard';
import { isPublicDashboardsEnabled } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { AccessControlAction } from 'app/types/accessControl';

import { ShareEmbed } from './ShareEmbed';
import { ShareExport } from './ShareExport';
import { ShareLibraryPanel } from './ShareLibraryPanel';
import { ShareLink } from './ShareLink';
import { ShareSnapshot } from './ShareSnapshot';
import { ShareModalTabModel, ShareModalTabProps } from './types';
import { getTrackingSource, shareDashboardType } from './utils';

const customDashboardTabs: ShareModalTabModel[] = [];
const customPanelTabs: ShareModalTabModel[] = [];

export function addDashboardShareTab(tab: ShareModalTabModel) {
  customDashboardTabs.push(tab);
}

export function addPanelShareTab(tab: ShareModalTabModel) {
  customPanelTabs.push(tab);
}

function getTabs(canEditDashboard: boolean, panel?: PanelModel, activeTab?: string) {
  const linkLabel = t('share-modal.tab-title.link', 'Link');
  const tabs: ShareModalTabModel[] = [{ label: linkLabel, value: shareDashboardType.link, component: ShareLink }];

  if (
    contextSrv.isSignedIn &&
    config.snapshotEnabled &&
    contextSrv.hasPermission(AccessControlAction.SnapshotsCreate)
  ) {
    const snapshotLabel = t('share-modal.tab-title.snapshot', 'Snapshot');
    tabs.push({ label: snapshotLabel, value: shareDashboardType.snapshot, component: ShareSnapshot });
  }

  if (panel) {
    const embedLabel = t('share-modal.tab-title.embed', 'Embed');
    tabs.push({ label: embedLabel, value: shareDashboardType.embed, component: ShareEmbedTab });

    if (!isPanelModelLibraryPanel(panel)) {
      const libraryPanelLabel = t('share-modal.tab-title.library-panel', 'Library panel');
      tabs.push({ label: libraryPanelLabel, value: shareDashboardType.libraryPanel, component: ShareLibraryPanel });
    }
    tabs.push(...customPanelTabs);
  } else {
    const exportLabel = t('share-modal.tab-title.export', 'Export');
    tabs.push({
      label: exportLabel,
      value: shareDashboardType.export,
      component: ShareExport,
    });
    tabs.push(...customDashboardTabs);

    if (isPublicDashboardsEnabled()) {
      tabs.push({
        label: t('share-modal.tab-title.public-dashboard-title', 'Public dashboard'),
        value: shareDashboardType.publicDashboard,
        component: SharePublicDashboard,
      });
    }
  }

  const at = tabs.find((t) => t.value === activeTab);

  return {
    tabs,
    activeTab: at?.value ?? tabs[0].value,
  };
}

function ShareEmbedTab(props: ShareModalTabProps) {
  return (
    <ShareEmbed
      dashboard={props.dashboard}
      panelId={String(props.panel?.id)}
      timeFrom={props.panel?.timeFrom}
      onDismiss={props.onDismiss}
    />
  );
}

interface Props {
  dashboard: DashboardModel;
  panel?: PanelModel;
  activeTab?: string;
  onDismiss(): void;
}

export function ShareModal({ dashboard, panel, activeTab: initialActiveTab, onDismiss }: Props) {
  const [activeTab, setActiveTab] = React.useState(() => {
    return getTabs(dashboard.canEditDashboard(), panel, initialActiveTab).activeTab;
  });

  const onSelectTab: React.ComponentProps<typeof ModalTabsHeader>['onChangeTab'] = React.useCallback(
    (t) => {
      setActiveTab(t.value);
      DashboardInteractions.sharingCategoryClicked({
        item: t.value,
        shareResource: getTrackingSource(panel),
      });
    },
    [panel]
  );

  const canEditDashboard = dashboard.canEditDashboard();
  const { tabs } = getTabs(canEditDashboard, panel, activeTab);
  const activeTabModel = tabs.find((t) => t.value === activeTab)!;
  const ActiveTab = activeTabModel.component;
  const modalTitle = panel ? t('share-modal.panel.title', 'Share Panel') : t('share-modal.dashboard.title', 'Share');

  const title = (
    <ModalTabsHeader title={modalTitle} icon="share-alt" tabs={tabs} activeTab={activeTab} onChangeTab={onSelectTab} />
  );

  return (
    <Modal ariaLabel={modalTitle} isOpen={true} title={title} onDismiss={onDismiss}>
      <TabContent>
        <ActiveTab dashboard={dashboard} panel={panel} onDismiss={onDismiss} />
      </TabContent>
    </Modal>
  );
}
