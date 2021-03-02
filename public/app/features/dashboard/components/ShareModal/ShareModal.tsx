import React from 'react';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { ShareLink } from './ShareLink';
import { ShareSnapshot } from './ShareSnapshot';
import { ShareExport } from './ShareExport';
import { ShareEmbed } from './ShareEmbed';
import { ShareModalTabModel } from './types';
import { contextSrv } from 'app/core/core';

const customDashboardTabs: ShareModalTabModel[] = [];
const customPanelTabs: ShareModalTabModel[] = [];

export function addDashboardShareTab(tab: ShareModalTabModel) {
  customDashboardTabs.push(tab);
}

export function addPanelShareTab(tab: ShareModalTabModel) {
  customPanelTabs.push(tab);
}

function getInitialState(props: Props): State {
  const tabs = getTabs(props);
  return {
    tabs,
    activeTab: tabs[0].value,
  };
}

function getTabs(props: Props) {
  const { panel } = props;

  const tabs: ShareModalTabModel[] = [{ label: 'Link', value: 'link', component: ShareLink }];

  if (contextSrv.isSignedIn) {
    tabs.push({ label: 'Snapshot', value: 'snapshot', component: ShareSnapshot });
  }

  if (panel) {
    tabs.push({ label: 'Embed', value: 'embed', component: ShareEmbed });
    tabs.push(...customPanelTabs);
  } else {
    tabs.push({ label: 'Export', value: 'export', component: ShareExport });
    tabs.push(...customDashboardTabs);
  }

  return tabs;
}

interface Props {
  dashboard: DashboardModel;
  panel?: PanelModel;

  onDismiss(): void;
}

interface State {
  tabs: ShareModalTabModel[];
  activeTab: string;
}

export class ShareModal extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = getInitialState(props);
  }

  onDismiss = () => {
    this.setState(getInitialState(this.props));
    this.props.onDismiss();
  };

  onSelectTab = (t: any) => {
    this.setState({ activeTab: t.value });
  };

  getTabs() {
    return getTabs(this.props);
  }

  getActiveTab() {
    const { tabs, activeTab } = this.state;
    return tabs.find((t) => t.value === activeTab)!;
  }

  renderTitle() {
    const { panel } = this.props;
    const { activeTab } = this.state;
    const title = panel ? 'Share Panel' : 'Share';
    const tabs = this.getTabs();

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
      <Modal isOpen={true} title={this.renderTitle()} onDismiss={this.onDismiss}>
        <TabContent>
          <ActiveTab dashboard={dashboard} panel={panel} onDismiss={this.onDismiss} />
        </TabContent>
      </Modal>
    );
  }
}
