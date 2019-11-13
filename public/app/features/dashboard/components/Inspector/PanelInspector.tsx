// Libraries
import React, { PureComponent } from 'react';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { JSONFormatter, Modal } from '@grafana/ui';
import { css } from 'emotion';
import { getLocationSrv } from '@grafana/runtime';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

interface State {}

export class PanelInspector extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  onDismiss = () => {
    getLocationSrv().update({
      query: { inspect: null },
      partial: true,
    });
  };

  render() {
    const { panel } = this.props;
    if (!panel) {
      this.onDismiss(); // Try to close the component
      return null;
    }
    const bodyStyle = css`
      max-height: 70vh;
      overflow-y: scroll;
    `;

    // TODO? should we get the result with an observable once?
    const data = (panel.getQueryRunner() as any).lastResult;
    return (
      <Modal
        title={
          <div className="modal-header-title">
            <i className="fa fa-info-circle" />
            <span className="p-l-1">{panel.title ? panel.title : 'Panel'}</span>
          </div>
        }
        onDismiss={this.onDismiss}
        isOpen={true}
      >
        <div className={bodyStyle}>
          <JSONFormatter json={data} open={2} />
        </div>
      </Modal>
    );
  }
}
