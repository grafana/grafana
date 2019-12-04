// Libraries
import React, { PureComponent } from 'react';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { JSONFormatter, Modal } from '@grafana/ui';
import { css } from 'emotion';
import { getLocationSrv, getDataSourceSrv } from '@grafana/runtime';
import { DataFrame, MetadataInspectorProps } from '@grafana/data';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

interface State {
  last?: any;
  meta?: MetadataInspectorProps<any, any, any>;
}

export class PanelInspector extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  async componentDidMount() {
    const { panel } = this.props;
    if (!panel) {
      this.onDismiss(); // Try to close the component
      return null;
    }

    // TODO? should we get the result with an observable once?
    const lastResult = (panel.getQueryRunner() as any).lastResult;
    if (!lastResult) {
      this.onDismiss(); // Usually opened from refresh?
      return null;
    }

    const inspectable = getInspectableMetadata(lastResult?.series as DataFrame[]);
    for (const key in inspectable) {
      const ds = await getDataSourceSrv().get(key);
      if (ds && ds.components.MetadataInspector) {
        this.setState({
          last: lastResult,
          meta: {
            datasource: ds,
            data: inspectable[key],
          },
        });
        return; // Only the first one for now!
      }
    }

    this.setState({ last: lastResult });
  }

  onDismiss = () => {
    getLocationSrv().update({
      query: { inspect: null },
      partial: true,
    });
  };

  renderInspectable = () => {
    const { meta } = this.state;
    const { MetadataInspector } = meta.datasource.components;
    if (MetadataInspector) {
      return <MetadataInspector {...meta} />;
    }
    return <div>MISSING inspector</div>;
  };

  render() {
    const { panel } = this.props;
    const { last, meta } = this.state;
    if (!panel) {
      this.onDismiss(); // Try to close the component
      return null;
    }
    const bodyStyle = css`
      max-height: 70vh;
      overflow-y: scroll;
    `;

    return (
      <Modal title={panel.title} icon="fa fa-info-circle" onDismiss={this.onDismiss} isOpen={true}>
        {meta && this.renderInspectable()}
        <div className={bodyStyle}>
          <JSONFormatter json={last} open={2} />
        </div>
      </Modal>
    );
  }
}

export function getInspectableMetadata(data: DataFrame[]): Record<string, DataFrame[]> | undefined {
  if (!data || !data.length) {
    return undefined;
  }

  let found = false;
  const grouped: Record<string, DataFrame[]> = {};
  for (const frame of data) {
    const id = frame.meta?.ds?.datasourceName;
    if (id) {
      if (!grouped[id]) {
        grouped[id] = [];
      }
      grouped[id].push(frame);
      found = true;
    }
  }
  if (found) {
    return grouped;
  }
  return undefined;
}
