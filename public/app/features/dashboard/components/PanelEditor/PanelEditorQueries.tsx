import React, { PureComponent } from 'react';
import { QueryGroup } from 'app/features/query/components/QueryGroup';
import { QueryGroupOptions } from 'app/features/query/components/QueryGroupOptions';
import { PanelModel } from '../../state';
import { DataQuery, DataSourceSelectItem } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';

interface Props {
  panel: PanelModel;
}

interface State {
  options: QueryGroupOptions;
}

export class PanelEditorQueries extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { options: this.buildQueryOptions(props) };
  }

  buildQueryOptions({ panel }: Props): QueryGroupOptions {
    return {
      maxDataPoints: panel.maxDataPoints,
      minInterval: panel.interval,
      timeRange: {
        from: panel.timeFrom,
        shift: panel.timeShift,
        hide: panel.hideTimeOverride,
      },
    };
  }

  onDataSourceChange = (ds: DataSourceSelectItem, queries: DataQuery[]) => {
    const { panel } = this.props;

    panel.datasource = ds.value;
    panel.targets = queries;
    panel.refresh();

    this.forceUpdate();
  };

  onRunQueries = () => {
    this.props.panel.refresh();
  };

  onQueriesChange = (queries: DataQuery[]) => {
    const { panel } = this.props;

    panel.targets = queries;
    panel.refresh();

    this.forceUpdate();
  };

  onOpenQueryInspector = () => {
    getLocationSrv().update({
      query: { inspect: this.props.panel.id, inspectTab: 'query' },
      partial: true,
    });
  };

  onQueryOptionsChange = (options: QueryGroupOptions) => {
    const { panel } = this.props;

    panel.timeFrom = options.timeRange?.from;
    panel.timeShift = options.timeRange?.shift;
    panel.hideTimeOverride = options.timeRange?.hide;
    panel.interval = options.minInterval;
    panel.maxDataPoints = options.maxDataPoints;
    panel.refresh();

    this.setState({ options: options });
  };

  render() {
    const { panel } = this.props;
    const { options } = this.state;

    return (
      <QueryGroup
        dataSourceName={panel.datasource}
        options={options}
        queryRunner={panel.getQueryRunner()}
        queries={panel.targets}
        onQueriesChange={this.onQueriesChange}
        onDataSourceChange={this.onDataSourceChange}
        onRunQueries={this.onRunQueries}
        onOpenQueryInspector={this.onOpenQueryInspector}
        onOptionsChange={this.onQueryOptionsChange}
      />
    );
  }
}
