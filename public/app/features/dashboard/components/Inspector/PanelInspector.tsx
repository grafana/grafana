// Libraries
import React, { PureComponent } from 'react';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { Drawer, JSONFormatter } from '@grafana/ui';
import { css } from 'emotion';
import { getLocationSrv } from '@grafana/runtime';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export class PanelInspector extends PureComponent<Props> {
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
      <Drawer title={panel.title} onClose={this.onDismiss}>
        <div className={bodyStyle}>
          <JSONFormatter json={data} open={2} />
        </div>
      </Drawer>
    );
  }
}
