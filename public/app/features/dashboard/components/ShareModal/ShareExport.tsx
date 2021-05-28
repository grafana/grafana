import React, { PureComponent } from 'react';
import { saveAs } from 'file-saver';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { Button, Field, Modal, Switch } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal';
import { appEvents } from 'app/core/core';
import { ShowModalReactEvent } from 'app/types/events';
import { ViewJsonModal } from './ViewJsonModal';
import { config } from '@grafana/runtime';

interface Props {
  dashboard: DashboardModel;
  panel?: PanelModel;
  onDismiss(): void;
}

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
      this.exporter.makeExportable(dashboard).then((dashboardJson: any) => {
        if (trimDefaults) {
          getBackendSrv()
            .post('/api/dashboards/trim', { dashboard: dashboardJson })
            .then((resp: any) => {
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
          .then((resp: any) => {
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
      this.exporter.makeExportable(dashboard).then((dashboardJson: any) => {
        if (trimDefaults) {
          getBackendSrv()
            .post('/api/dashboards/trim', { dashboard: dashboardJson })
            .then((resp: any) => {
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
          .then((resp: any) => {
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

    this.props.onDismiss();
  };

  render() {
    const { onDismiss } = this.props;
    const { shareExternally } = this.state;
    const { trimDefaults } = this.state;

    return (
      <>
        <p className="share-modal-info-text">Export this dashboard.</p>
        <Field label="Export for sharing externally">
          <Switch value={shareExternally} onChange={this.onShareExternallyChange} />
        </Field>
        {config.featureToggles.trimDefaults && (
          <Field label="Export with default values removed">
            <Switch value={trimDefaults} onChange={this.onTrimDefaultsChange} />
          </Field>
        )}
        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            Cancel
          </Button>
          <Button variant="secondary" onClick={this.onViewJson}>
            View JSON
          </Button>
          <Button variant="primary" onClick={this.onSaveAsFile}>
            Save to file
          </Button>
        </Modal.ButtonRow>
      </>
    );
  }
}
