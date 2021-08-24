import React from 'react';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { isPanelModelLibraryPanel } from 'app/features/library-panels/guard';
import { ShareLink } from './ShareLink';
import { ShareSnapshot } from './ShareSnapshot';
import { ShareExport } from './ShareExport';
import { ShareEmbed } from './ShareEmbed';
import { contextSrv } from 'app/core/core';
import { ShareLibraryPanel } from './ShareLibraryPanel';

export interface ModalModel {
  title: string;
  component: JSX.Element;
}

const content: ModalModel[] = [];

export function addQueryModal(modal: ModalModel) {
  content.push(modal);
}

function getModals(props: Props) {
  const { panel } = props;

  const tabs: ModalModel[] = [{ label: 'Link', value: 'link', component: ShareLink }];

  if (contextSrv.isSignedIn) {
    tabs.push({ label: 'Snapshot', value: 'snapshot', component: ShareSnapshot });
  }

  if (panel) {
    tabs.push({ label: 'Embed', value: 'embed', component: ShareEmbed });

    if (!isPanelModelLibraryPanel(panel)) {
      tabs.push({ label: 'Library panel', value: 'library_panel', component: ShareLibraryPanel });
    }
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
  modals: ModalModel[];
  activeTab: string;
}

export class QueryModal extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  // onDismiss = () => {
  //   //this.setState(getInitialState(this.props));
  //   this.props.onDismiss();
  // };

  onSelectTab = (t: any) => {
    this.setState({ activeTab: t.value });
  };

  getTabs() {
    return getModals(this.props);
  }

  getActiveTab() {
    const { modals, activeTab } = this.state;
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
      <Modal isOpen={true} title={activeTabModal.title} onDismiss={this.props.onDismiss}>
        <TabContent>{}</TabContent>
      </Modal>
    );
  }
}
