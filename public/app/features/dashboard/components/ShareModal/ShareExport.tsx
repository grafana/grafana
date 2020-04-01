import React, { PureComponent } from 'react';
import { saveAs } from 'file-saver';
import { Button, Switch } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal';
import { appEvents } from 'app/core/core';
import { CoreEvents } from 'app/types';

interface Props {
  dashboard: DashboardModel;
  panel?: PanelModel;
  onDismiss(): void;
}

interface State {
  shareExternally: boolean;
}

export class ShareExport extends PureComponent<Props, State> {
  private exporter: DashboardExporter;

  constructor(props: Props) {
    super(props);
    this.state = {
      shareExternally: false,
    };

    this.exporter = new DashboardExporter();
  }

  onShareExternallyChange = () => {
    this.setState({
      shareExternally: !this.state.shareExternally,
    });
  };

  onSaveAsFile = () => {
    const { dashboard } = this.props;
    const { shareExternally } = this.state;

    if (shareExternally) {
      this.exporter.makeExportable(dashboard).then((dashboardJson: any) => {
        this.openSaveAsDialog(dashboardJson);
      });
    } else {
      this.openSaveAsDialog(dashboard.getSaveModelClone());
    }
  };

  onViewJson = () => {
    const { dashboard } = this.props;
    const { shareExternally } = this.state;

    if (shareExternally) {
      this.exporter.makeExportable(dashboard).then((dashboardJson: any) => {
        this.openJsonModal(dashboardJson);
      });
    } else {
      this.openJsonModal(dashboard.getSaveModelClone());
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
    const model = {
      object: clone,
      enableCopy: true,
    };

    appEvents.emit(CoreEvents.showModal, {
      src: 'public/app/partials/edit_json.html',
      model,
    });

    this.props.onDismiss();
  };

  render() {
    const { onDismiss } = this.props;
    const { shareExternally } = this.state;

    return (
      <div className="share-modal-body">
        <div className="share-modal-header">
          <div className="share-modal-big-icon">
            <i className="fa fa-cloud-upload"></i>
          </div>
          <div className="share-modal-content">
            <Switch
              labelClass="width-16"
              label="Export for sharing externally"
              checked={shareExternally}
              onChange={this.onShareExternallyChange}
            />

            <div className="gf-form-button-row">
              <Button variant="primary" onClick={this.onSaveAsFile}>
                Save to file
              </Button>
              <Button variant="secondary" onClick={this.onViewJson}>
                View JSON
              </Button>
              <Button variant="secondary" onClick={onDismiss}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
