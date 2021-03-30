import React, { PureComponent } from 'react';
import { getLocationSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/data';

import { QueryGroup } from 'app/features/query/components/QueryGroup';
import { DashboardModel, PanelModel } from '../../state';
import { QueryGroupOptions } from 'app/types';

interface Props {
  /** Current dashboard */
  dashboard: DashboardModel;
  /** Current panel */
  panel: PanelModel;
  /** Added here to make component re-render when queries change from outside */
  queries: DataQuery[];
}

export class PanelEditorQueries extends PureComponent<Props> {
  buildQueryOptions(panel: PanelModel): QueryGroupOptions {
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
  };

  render() {
    const { panel, dashboard } = this.props;
    const options = this.buildQueryOptions(panel);

    return (
      <QueryGroup
        options={options}
        queryRunner={panel.getQueryRunner()}
        onRunQueries={this.onRunQueries}
        onOpenQueryInspector={this.onOpenQueryInspector}
        onOptionsChange={this.onOptionsChange}
        dashboardEvents={dashboard.events}
      />
    );
  }
}
