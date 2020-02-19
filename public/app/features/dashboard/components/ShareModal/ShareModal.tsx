import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, Modal, TabsBar, Tab, TabContent, withTheme, Themeable, Icon } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { ShareLink } from './ShareLink';
import { ShareSnapshot } from './ShareSnapshot';
import { ShareExport } from './ShareExport';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  modal: css``,
  modalHeader: css`
    background: ${theme.background.pageHeader};
    box-shadow: ${theme.shadow.pageHeader};
    border-bottom: 1px solid ${theme.colors.pageHeaderBorder};
    display: flex;
  `,
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
  modalContent: css``,
  modalText: css`
    font-size: ${theme.typography.heading.h4};
    color: ${theme.colors.link};
    margin-bottom: calc(${theme.spacing.d} * 2);
    padding-top: ${theme.spacing.d};
  `,
  modalButtonRow: css`
    margin-bottom: 14px;
    a,
    button {
      margin-right: ${theme.spacing.d};
    }
  `,
}));

const shareModalTabs = [
  { label: 'Link', value: 'link' },
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
    const { tab } = this.state;

    return (
      <TabsBar>
        {shareModalTabs.map((t, index) => {
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
    const { theme } = this.props;
    const styles = getStyles(theme);

    return (
      <>
        <h2 className={styles.modalHeaderTitle}>
          <Icon name="share-square-o" className={styles.modalHeaderIcon} />
          Share
        </h2>
        {this.renderTabsBar()}
      </>
    );
  }

  render() {
    const { isOpen, dashboard, panel, theme } = this.props;
    const { tab } = this.state;
    const styles = getStyles(theme);

    return (
      <Modal className={styles.modal} title={this.renderTitle()} isOpen={isOpen} onDismiss={this.onDismiss}>
        <div className={styles.modalContent}>
          <TabContent>
            {tab === 'link' && <ShareLink dashboard={dashboard} panel={panel} />}
            {tab === 'snapshot' && <ShareSnapshot dashboard={dashboard} panel={panel} onDismiss={this.onDismiss} />}
            {tab === 'export' && <ShareExport dashboard={dashboard} panel={panel} onDismiss={this.onDismiss} />}
          </TabContent>
        </div>
      </Modal>
    );
  }
}

export const ShareModal = withTheme(ShareModalUnthemed);
