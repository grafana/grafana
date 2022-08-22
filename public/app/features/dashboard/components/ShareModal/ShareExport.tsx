import { Trans, t } from '@lingui/macro';
import { saveAs } from 'file-saver';
import React, { PureComponent } from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import { Button, Field, Modal, Switch } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal';
import { ShowModalReactEvent } from 'app/types/events';

import { ViewJsonModal } from './ViewJsonModal';
import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps {}

interface State {
  shareExternally: boolean;
  trimDefaults: boolean;
}

export class ShareExport extends PureComponent<Props, State> {
  private exporter: DashboardExporter;

  constructor(props: Props) {
    super(props);
    this.state = {
      shareExternally: false,
      trimDefaults: false,
    };

    this.exporter = new DashboardExporter();
  }

  componentDidMount() {
    reportInteraction('grafana_dashboards_export_share_viewed');
  }

  onShareExternallyChange = () => {
    this.setState({
      shareExternally: !this.state.shareExternally,
    });
  };

  onTrimDefaultsChange = () => {
    this.setState({
      trimDefaults: !this.state.trimDefaults,
    });
  };

  onSaveAsFile = () => {
    const { dashboard } = this.props;
    const { shareExternally } = this.state;
    const { trimDefaults } = this.state;

    if (shareExternally) {
      this.exporter.makeExportable(dashboard).then((dashboardJson) => {
        if (trimDefaults) {
          getBackendSrv()
            .post('/api/dashboards/trim', { dashboard: dashboardJson })
            .then((resp) => {
              this.openSaveAsDialog(resp.dashboard);
            });
        } else {
          this.openSaveAsDialog(dashboardJson);
        }
      });
    } else {
      if (trimDefaults) {
        getBackendSrv()
          .post('/api/dashboards/trim', { dashboard: dashboard.getSaveModelClone() })
          .then((resp) => {
            this.openSaveAsDialog(resp.dashboard);
          });
      } else {
        this.openSaveAsDialog(dashboard.getSaveModelClone());
      }
    }
  };

  onViewJson = () => {
    const { dashboard } = this.props;
    const { shareExternally } = this.state;
    const { trimDefaults } = this.state;

    if (shareExternally) {
      this.exporter.makeExportable(dashboard).then((dashboardJson) => {
        if (trimDefaults) {
          getBackendSrv()
            .post('/api/dashboards/trim', { dashboard: dashboardJson })
            .then((resp) => {
              this.openJsonModal(resp.dashboard);
            });
        } else {
          this.openJsonModal(dashboardJson);
        }
      });
    } else {
      if (trimDefaults) {
        getBackendSrv()
          .post('/api/dashboards/trim', { dashboard: dashboard.getSaveModelClone() })
          .then((resp) => {
            this.openJsonModal(resp.dashboard);
          });
      } else {
        this.openJsonModal(dashboard.getSaveModelClone());
      }
    }
  };

  openSaveAsDialog = (dash: any) => {
    const dashboardJsonPretty = JSON.stringify(dash, null, 2);
    const blob = new Blob([dashboardJsonPretty], {
      type: 'application/json;charset=utf-8',
    });
    const time = new Date().getTime();
    saveAs(blob, `${dash.title}-${time}.json`);
  };

  openJsonModal = (clone: object) => {
    appEvents.publish(
      new ShowModalReactEvent({
        props: {
          json: JSON.stringify(clone, null, 2),
        },
        component: ViewJsonModal,
      })
    );

    this.props.onDismiss?.();
  };

  render() {
    const { onDismiss } = this.props;
    const { shareExternally } = this.state;
    const { trimDefaults } = this.state;

    const exportExternallyTranslation = t({
      id: 'share-modal.export.share-externally-label',
      message: `Export for sharing externally`,
    });

    const exportDefaultTranslation = t({
      id: 'share-modal.export.share-default-label',
      message: `Export with default values removed`,
    });

    return (
      <>
        <p className="share-modal-info-text">
          <Trans id="share-modal.export.info-text">Export this dashboard.</Trans>
        </p>
        <Field label={exportExternallyTranslation}>
          <Switch id="share-externally-toggle" value={shareExternally} onChange={this.onShareExternallyChange} />
        </Field>
        {config.featureToggles.trimDefaults && (
          <Field label={exportDefaultTranslation}>
            <Switch id="trim-defaults-toggle" value={trimDefaults} onChange={this.onTrimDefaultsChange} />
          </Field>
        )}
        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans id="share-modal.export.cancel-button">Cancel</Trans>
          </Button>
          <Button variant="secondary" onClick={this.onViewJson}>
            <Trans id="share-modal.export.view-button">View JSON</Trans>
          </Button>
          <Button variant="primary" onClick={this.onSaveAsFile}>
            <Trans id="share-modal.export.save-button">Save to file</Trans>
          </Button>
        </Modal.ButtonRow>
      </>
    );
  }
}
