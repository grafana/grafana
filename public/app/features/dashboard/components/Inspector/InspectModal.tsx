// Libraries
import React, { PureComponent } from 'react';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { JSONFormatter, Modal } from '@grafana/ui';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

interface State {}

export class InspectModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  onDismiss = () => {
    this.props.dashboard.inspect(null);
  };

  render() {
    const { panel } = this.props;
    if (!panel) {
      this.onDismiss(); // Try to close the component
      return null;
    }

    // TODO? should we get the result with an observable once?
    const data = (panel.getQueryRunner() as any).lastResult;
    return (
      <Modal
        title={
          <div className="modal-header-title">
            <i className="fa fa-share-square-o" />
            <span className="p-l-1">My Modal</span>
          </div>
        }
        onDismiss={this.onDismiss}
        isOpen={true}
      >
        <div>
          BEFOREY
          <JSONFormatter json={data} open={2} />
          AFTERY ID: {panel.id}
        </div>
      </Modal>
    );
  }
}
