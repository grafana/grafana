import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime/src';
import {
  Button,
  CodeEditor,
  Modal,
  ModalHeader,
  ModalTabsHeader,
  TabContent,
  Themeable2,
  withTheme2,
} from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

interface Props extends Themeable2 {
  dashboard: DashboardModel;
  panel?: PanelModel;
  activeTab?: string;

  onDismiss(): void;
}

class UnthemedCustomExportModal extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    reportInteraction('grafana_dashboards_custom_export_modal_viewed');
  }

  renderTitle() {
    const { panel } = this.props;
    const title = panel
      ? t('custom-export-modal.panel.title', 'Export Panel')
      : t('custom-export-modal.dashboard.title', 'Export');

    return <ModalHeader title={title} />;
  }

  render() {
    const { dashboard, panel, theme } = this.props;
    const styles = getStyles(theme);

    return (
      <Modal
        isOpen={true}
        title={this.renderTitle()}
        onDismiss={this.props.onDismiss}
        className={styles.container}
        contentClassName={styles.content}
      >
        <TabContent>
          <CodeEditor value={''} language={''} width="100%" height={100} />
          {/*<<ActiveTab dashboard={dashboard} panel={panel} onDismiss={this.props.onDismiss} />> */}
        </TabContent>

        <Modal.ButtonRow>
          <Button variant="primary" onClick={() => console.log('test')}>
            <Trans i18nKey="custom-export-modal.snapshot.local-button">Save to .txt</Trans>
          </Button>
        </Modal.ButtonRow>
      </Modal>
    );
  }
}

export const CustomExportModal = withTheme2(UnthemedCustomExportModal);

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      label: 'shareModalContainer',
      paddingTop: theme.spacing(1),
    }),
    content: css({
      label: 'shareModalContent',
      padding: theme.spacing(3, 2, 2, 2),
    }),
  };
};
