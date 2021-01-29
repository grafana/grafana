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

    panel.datasource = options.dataSource.default ? null : options.dataSource.name!;
    panel.targets = options.queries;
    panel.timeFrom = options.timeRange?.from;
    panel.timeShift = options.timeRange?.shift;
    panel.hideTimeOverride = options.timeRange?.hide;
    panel.interval = options.minInterval;
    panel.maxDataPoints = options.maxDataPoints;

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
