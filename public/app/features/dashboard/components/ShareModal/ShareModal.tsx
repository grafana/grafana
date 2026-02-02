import { PureComponent, lazy, Suspense } from 'react';
import * as React from 'react';

import { Modal, ModalTabsHeader, TabContent, Themeable2, withTheme2, LoadingPlaceholder } from '@grafana/ui';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { SharePublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboard';
import { isPublicDashboardsEnabled } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { getGrafanaFeatureStatus, FEATURE_CONST } from 'app/features/dashboard/services/featureFlagSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { AccessControlAction } from 'app/types';

import { ShareEmbed } from './ShareEmbed';
import { ShareExport } from './ShareExport';
import { ShareLibraryPanel } from './ShareLibraryPanel';
import { ShareLink, Props as ShareProps } from './ShareLink';
import { ShareSnapshot } from './ShareSnapshot';
import { ShareModalTabModel } from './types';
import { getTrackingSource, shareDashboardType } from './utils';

// BMC code
const ExportUtility = lazy(() => import(/* webpackChunkName: "ExportUtility" */ './ExportUtility'));

const renderLoader = () => {
  return (
    <div className="preloader">
      <LoadingPlaceholder text={t('bmc.share-modal.loading', 'Loading') + '...'} />
    </div>
  );
};

export class LazyExportUtility extends PureComponent<ShareProps> {
  constructor(props: ShareProps) {
    super(props);
  }

  render() {
    return (
      <Suspense fallback={renderLoader()}>
        <ExportUtility {...this.props} />
      </Suspense>
    );
  }
}
// End
// prettier-ignore

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

  // BMC code
  const canDownloadReport = contextSrv.hasPermission('dashboards:download');

  const downloadLabel = t('bmc.common.download', 'Download');
  const downloadTab: ShareModalTabModel[] = [{ label: downloadLabel, value: 'download', component: LazyExportUtility }];
  // end

  // BMC code - inline change
  if (
    contextSrv.isSignedIn &&
    config.snapshotEnabled &&
    contextSrv.hasPermission(AccessControlAction.SnapshotsCreate) && 
    getGrafanaFeatureStatus(FEATURE_CONST.snapshot)
  ) {
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
    // BMC code
    if (!panel.isEditing && canDownloadReport) {
      tabs.push(...downloadTab);
    }
    // End
  } else {
    const exportLabel = t('share-modal.tab-title.export', 'Export');
    tabs.push({
      label: exportLabel,
      value: shareDashboardType.export,
      component: ShareExport,
    });
    tabs.push(...customDashboardTabs);
    // BMC code - next line
    if (canDownloadReport) {
      tabs.push(...downloadTab);
    }
  }

  if (isPublicDashboardsEnabled()) {
    tabs.push({
      label: t('share-modal.tab-title.public-dashboard-title', 'Public dashboard'),
      value: shareDashboardType.publicDashboard,
      component: SharePublicDashboard,
    });
  }  

  const at = tabs.find((t) => t.value === activeTab);

  return {
    tabs,
    activeTab: at?.value ?? tabs[0].value,
  };
}

interface Props extends Themeable2 {
  dashboard: DashboardModel;
  panel?: PanelModel;
  activeTab?: string;
  // BMC code - inline change
  onDismiss?(): void;
}

interface State {
  tabs: ShareModalTabModel[];
  activeTab: string;
}

function getInitialState(props: Props): State {
  const { tabs, activeTab } = getTabs(props.dashboard.canEditDashboard(), props.panel, props.activeTab);

  return {
    tabs,
    activeTab,
  };
}

class UnthemedShareModal extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = getInitialState(props);
  }

  onSelectTab: React.ComponentProps<typeof ModalTabsHeader>['onChangeTab'] = (t) => {
    this.setState((prevState) => ({ ...prevState, activeTab: t.value }));
    DashboardInteractions.sharingCategoryClicked({
      item: t.value,
      shareResource: getTrackingSource(this.props.panel),
    });
  };

  getActiveTab() {
    const { tabs, activeTab } = this.state;
    return tabs.find((t) => t.value === activeTab)!;
  }

  renderTitle() {
    const { panel } = this.props;
    const { activeTab } = this.state;
    const title = panel ? t('share-modal.panel.title', 'Share Panel') : t('share-modal.dashboard.title', 'Share');
    const canEditDashboard = this.props.dashboard.canEditDashboard();
    const tabs = getTabs(canEditDashboard, this.props.panel, this.state.activeTab).tabs;

    return (
      <ModalTabsHeader
        title={title}
        icon="share-alt"
        tabs={tabs}
        activeTab={activeTab}
        onChangeTab={this.onSelectTab}
      />
    );
  }

  render() {
    const { dashboard, panel } = this.props;
    const activeTabModel = this.getActiveTab();
    const ActiveTab = activeTabModel.component;

    return (
      <Modal isOpen={true} title={this.renderTitle()} onDismiss={this.props.onDismiss}>
        <TabContent>
          <ActiveTab dashboard={dashboard} panel={panel} onDismiss={this.props.onDismiss} />
        </TabContent>
      </Modal>
    );
  }
}

export const ShareModal = withTheme2(UnthemedShareModal);
