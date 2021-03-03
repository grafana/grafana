import React, { PureComponent } from 'react';
import { QueryGroup } from 'app/features/query/components/QueryGroup';
import { PanelModel } from '../../state';
import { getLocationSrv } from '@grafana/runtime';
import { QueryGroupOptions } from 'app/types';

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
      dataSource: {
        name: panel.datasource,
      },
      queries: panel.targets,
      maxDataPoints: panel.maxDataPoints,
      minInterval: panel.interval,
      timeRange: {
        from: panel.timeFrom,
        shift: panel.timeShift,
        hide: panel.hideTimeOverride,
      },
    };
  }

  onRunQueries = () => {
    this.props.panel.refresh();
  };

  onOpenQueryInspector = () => {
    getLocationSrv().update({
      query: { inspect: this.props.panel.id, inspectTab: 'query' },
      partial: true,
    });
  };

  onOptionsChange = (options: QueryGroupOptions) => {
    const { panel } = this.props;

    const newDataSourceName = options.dataSource.default ? null : options.dataSource.name!;
    const dataSourceChanged = newDataSourceName !== panel.datasource;

    panel.updateQueries(options);

    if (dataSourceChanged) {
      // trigger queries when changing data source
      setTimeout(this.onRunQueries, 10);
    }

    this.setState({ options: options });
  };

  render() {
    const { panel } = this.props;
    const { options } = this.state;

    return (
      <QueryGroup
        options={options}
        queryRunner={panel.getQueryRunner()}
        onRunQueries={this.onRunQueries}
        onOpenQueryInspector={this.onOpenQueryInspector}
        onOptionsChange={this.onOptionsChange}
      />
    );
  }
}
