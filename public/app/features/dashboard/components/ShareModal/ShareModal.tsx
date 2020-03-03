import React, { PureComponent } from 'react';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { ShareLink } from './ShareLink';
import { ShareSnapshot } from './ShareSnapshot';
import { ShareExport } from './ShareExport';
import { ShareEmbed } from './ShareEmbed';
import { ShareModalTabModel } from './types';

const shareModalTabs: ShareModalTabModel[] = [
  { label: 'Link', value: 'link', component: ShareLink },
  { label: 'Embed', value: 'embed', component: ShareEmbed },
  { label: 'Snapshot', value: 'snapshot', component: ShareSnapshot },
  { label: 'Export', value: 'export', component: ShareExport },
];

interface Props {
  dashboard: DashboardModel;
  panel?: PanelModel;

  onDismiss(): void;
}

interface State {
  tab: string;
}

function getInitialState(): State {
  return {
    tab: shareModalTabs[0].value,
  };
}

export class ShareModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = getInitialState();
  }

  onDismiss = () => {
    this.setState(getInitialState());
    this.props.onDismiss();
  };

  onSelectTab = (t: any) => {
    this.setState({ tab: t.value });
  };

  getTabs() {
    const { panel } = this.props;

    // Filter tabs for dashboard/panel share modal
    return shareModalTabs.filter(t => {
      if (panel) {
        return t.value !== 'export';
      }
      return t.value !== 'embed';
    });
  }

  getActiveTab() {
    const { tab } = this.state;
    return shareModalTabs.find(t => t.value === tab);
  }

  renderTitle() {
    const { panel } = this.props;
    const { tab } = this.state;
    const title = panel ? 'Share Panel' : 'Share';
    const tabs = this.getTabs();

    return (
      <ModalTabsHeader title={title} icon="share-square-o" tabs={tabs} activeTab={tab} onChangeTab={this.onSelectTab} />
    );
  }

  render() {
    const { dashboard, panel } = this.props;
    const activeTabModel = this.getActiveTab();
    const ActiveTab = activeTabModel?.component;

    return (
      <Modal isOpen={true} title={this.renderTitle()} onDismiss={this.onDismiss}>
        <TabContent>
          <ActiveTab dashboard={dashboard} panel={panel} onDismiss={this.onDismiss} />
        </TabContent>
      </Modal>
    );
  }
}
