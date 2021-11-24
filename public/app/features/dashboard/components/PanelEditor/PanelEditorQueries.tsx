import React, { PureComponent } from 'react';
import { QueryGroup } from 'app/features/query/components/QueryGroup';
import { PanelModel } from '../../state';
import { getLocationSrv } from '@grafana/runtime';
import { QueryGroupDataSource, QueryGroupOptions } from 'app/types';
import { DataQuery } from '@grafana/data';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

interface Props {
  /** Current panel */
  panel: PanelModel;
  /** Added here to make component re-render when queries change from outside */
  queries: DataQuery[];
}

export class PanelEditorQueries extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  buildQueryOptions(panel: PanelModel): QueryGroupOptions {
    const dataSource: QueryGroupDataSource = panel.datasource?.uid
      ? {
          default: false,
          ...panel.datasource,
        }
      : {
          default: true,
        };

    const datasourceSettings = getDatasourceSrv().getInstanceSettings(dataSource.uid);

    return {
      cacheTimeout: datasourceSettings?.meta.queryOptions?.cacheTimeout ? panel.cacheTimeout : undefined,
      dataSource,
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

    const newDataSourceID = options.dataSource.default ? null : options.dataSource.uid!;
    const dataSourceChanged = newDataSourceID !== panel.datasource?.uid;
    panel.updateQueries(options);

    if (dataSourceChanged) {
      // trigger queries when changing data source
      setTimeout(this.onRunQueries, 10);
    }

    this.forceUpdate();
  };

  render() {
    const { panel } = this.props;
    const options = this.buildQueryOptions(panel);

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
