import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, Modal, TabsBar, Tab, TabContent, withTheme, Themeable, Icon } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { ShareLink } from './ShareLink';
import { ShareSnapshot } from './ShareSnapshot';
import { ShareExport } from './ShareExport';
import { ShareEmbed } from './ShareEmbed';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  modalHeaderTitle: css`
    font-size: ${theme.typography.heading.h3};
    padding-top: ${theme.spacing.sm};
    margin: 0 ${theme.spacing.md};
  `,
  modalHeaderIcon: css`
    margin-right: ${theme.spacing.md};
    font-size: inherit;
    &:before {
      vertical-align: baseline;
    }
  `,
}));

const shareModalTabs = [
  { label: 'Link', value: 'link' },
  { label: 'Embed', value: 'embed' },
  { label: 'Snapshot', value: 'snapshot' },
  { label: 'Export', value: 'export' },
];

interface Props extends Themeable {
  isOpen: boolean;
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

export class ShareModalUnthemed extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = getInitialState();
  }

  onDismiss = () => {
    this.setState(getInitialState());
    this.props.onDismiss();
  };

  onSelectTab = (t: any) => () => {
    this.setState({ tab: t.value });
  };

  renderTabsBar() {
    const { panel } = this.props;
    const { tab } = this.state;

    return (
      <TabsBar hideBorder={true}>
        {shareModalTabs.map((t, index) => {
          // Filter tabs for dashboard/panel share modal
          if ((panel && t.value === 'export') || (!panel && t.value === 'embed')) {
            return null;
          }

          return (
            <Tab
              key={`${t.value}-${index}`}
              label={t.label}
              active={t.value === tab}
              onChangeTab={this.onSelectTab(t)}
            />
          );
        })}
      </TabsBar>
    );
  }

  renderTitle() {
    const { theme, panel } = this.props;
    const styles = getStyles(theme);
    const title = panel ? 'Share Panel' : 'Share';

    return (
      <>
        <h2 className={styles.modalHeaderTitle}>
          <Icon name="share-square-o" className={styles.modalHeaderIcon} />
          {title}
        </h2>
        {this.renderTabsBar()}
      </>
    );
  }

  render() {
    const { isOpen, dashboard, panel } = this.props;
    const { tab } = this.state;

    return (
      <Modal title={this.renderTitle()} isOpen={isOpen} onDismiss={this.onDismiss}>
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

export const ShareModal = withTheme(ShareModalUnthemed);
