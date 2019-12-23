import React, { PureComponent } from 'react';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { JSONFormatter, Drawer, Select } from '@grafana/ui';
import { getLocationSrv, getDataSourceSrv } from '@grafana/runtime';
import { DataFrame, DataSourceApi, SelectableValue } from '@grafana/data';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

enum InspectTab {
  Data = 'data',
  Meta = 'meta',
  Raw = 'raw',
  Issue = 'issue',
}

interface State {
  last?: any;
  data: DataFrame[];
  tab: InspectTab;
  metaDS?: DataSourceApi;
}

export class PanelInspector extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      data: [],
      tab: InspectTab.Data,
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

    // Find the first DataSource wanting to show custom metadata
    let metaDS: DataSourceApi;
    const data = lastResult?.series as DataFrame[];
    if (data) {
      for (const frame of data) {
        const key = frame.meta?.ds?.datasourceName;
        if (key) {
          const ds = await getDataSourceSrv().get(key);
          if (ds && ds.components.MetadataInspector) {
            metaDS = ds;
            break;
          }
        }
      }
    }

    // Set last result, but no metadata inspector
    this.setState({
      last: lastResult,
      data,
      metaDS,
    });
  }

  onDismiss = () => {
    getLocationSrv().update({
      query: { inspect: null },
      partial: true,
    });
  };

  onSelectTab = (item: SelectableValue<InspectTab>) => {
    this.setState({ tab: item.value || InspectTab.Data });
  };

  renderMetaDataInspector() {
    const { metaDS, data } = this.state;
    if (!metaDS || !metaDS.components?.MetadataInspector) {
      return <div>No Metadata Inspector</div>;
    }
    return <metaDS.components.MetadataInspector datasource={metaDS} data={data} />;
  }

  render() {
    const { panel } = this.props;
    const { last, tab } = this.state;
    if (!panel) {
      this.onDismiss(); // Try to close the component
      return null;
    }

    const tabs = [
      { label: 'Data', value: InspectTab.Data },
      { label: 'Issue', value: InspectTab.Issue },
      { label: 'Raw JSON', value: InspectTab.Raw },
    ];
    if (this.state.metaDS) {
      tabs.push({ label: 'Meta Data', value: InspectTab.Meta });
    }

    return (
      <Drawer title={panel.title} onClose={this.onDismiss}>
        <Select options={tabs} value={tabs.find(t => t.value === tab)} onChange={this.onSelectTab} />

        {tab === InspectTab.Data && <div>TODO: SHOW Table w/data</div>}

        {tab === InspectTab.Meta && this.renderMetaDataInspector()}

        {tab === InspectTab.Issue && <div>TODO: Submit issue form</div>}

        {tab === InspectTab.Raw && (
          <div>
            <JSONFormatter json={last} open={2} />
          </div>
        )}
      </Drawer>
    );
  }
}
