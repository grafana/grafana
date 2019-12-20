import React, { PureComponent } from 'react';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { JSONFormatter, Drawer, Select } from '@grafana/ui';
import { getLocationSrv, getDataSourceSrv } from '@grafana/runtime';
import { DataFrame, DataSourceApi, SelectableValue } from '@grafana/data';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

interface State {
  last?: any;
  data: DataFrame[];
  selected: number;
  ds?: DataSourceApi;
}

export class PanelInspector extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      data: [],
      selected: 0,
    };
  }

  async componentDidMount() {
    const { panel } = this.props;
    if (!panel) {
      this.onDismiss(); // Try to close the component
      return;
    }

    // TODO? should we get the result with an observable once?
    const lastResult = (panel.getQueryRunner() as any).lastResult;
    if (!lastResult) {
      this.onDismiss(); // Usually opened from refresh?
      return;
    }

    const data = lastResult?.series as DataFrame[];

    // const inspectable = getInspectableMetadata();
    // for (const key in inspectable) {
    //   const ds = await getDataSourceSrv().get(key);
    //   if (ds && ds.components.MetadataInspector) {
    //     this.setState({
    //       last: lastResult,
    //       meta: {
    //         datasource: ds,
    //         data: inspectable[key],
    //       },
    //     });
    //     return; // Only the first one for now!
    //   }
    // }

    // Set last result, but no metadata inspector
    this.setState({
      last: lastResult,
      data,
    });
  }

  async componentDidUpdate(prevProps: Props, prevState: State) {
    const { data, selected } = this.state;
    if (data !== prevState.data || selected !== prevState.selected) {
      let ds: DataSourceApi | undefined = undefined;
      const id = data[selected].meta?.ds?.datasourceName;
      if (id) {
        ds = await getDataSourceSrv().get(id);
      }
      this.setState({ ds });
    }
  }

  onDismiss = () => {
    getLocationSrv().update({
      query: { inspect: null },
      partial: true,
    });
  };

  onSelectFrame = (item: SelectableValue<number>) => {
    this.setState({ selected: item.value || 0 });
  };

  render() {
    const { panel } = this.props;
    const { last, data, selected, ds } = this.state;
    if (!panel) {
      this.onDismiss(); // Try to close the component
      return null;
    }

    const frames = data.map((frame, index) => {
      const title = frame.name || frame.refId;
      return {
        value: index,
        label: `${title} (${index})`,
      };
    });

    return (
      <Drawer title={panel.title} onClose={this.onDismiss}>
        {frames && (
          <>
            <Select options={frames} value={frames[selected]} onChange={this.onSelectFrame} />
            <div>
              {ds?.components?.MetadataInspector && (
                <ds.components.MetadataInspector datasource={ds} data={data[selected]} />
              )}
            </div>
            <br />
          </>
        )}

        <JSONFormatter json={last} open={2} />
      </Drawer>
    );
  }
}
