import React, { PureComponent } from 'react';
import { Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { ShareLink } from './ShareLink';
import { ShareSnapshot } from './ShareSnapshot';
import { ShareExport } from './ShareExport';
import { ShareEmbed } from './ShareEmbed';

const shareModalTabs = [
  { label: 'Link', value: 'link' },
  { label: 'Embed', value: 'embed' },
  { label: 'Snapshot', value: 'snapshot' },
  { label: 'Export', value: 'export' },
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
    const { tab } = this.state;

    return (
      <Modal isOpen={true} title={this.renderTitle()} onDismiss={this.onDismiss}>
        <TabContent>
          {tab === 'link' && <ShareLink dashboard={dashboard} panel={panel} />}
          {tab === 'embed' && panel && <ShareEmbed dashboard={dashboard} panel={panel} />}
          {tab === 'snapshot' && <ShareSnapshot dashboard={dashboard} panel={panel} onDismiss={this.onDismiss} />}
          {tab === 'export' && !panel && <ShareExport dashboard={dashboard} panel={panel} onDismiss={this.onDismiss} />}
        </TabContent>
      </Modal>
    );
  }
}
