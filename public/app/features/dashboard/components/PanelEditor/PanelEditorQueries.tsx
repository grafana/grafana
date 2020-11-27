import React, { PureComponent } from 'react';
import { QueriesTab } from 'app/features/query/components/QueriesTab';
import { QueryOptions } from 'app/features/query/components/QueryOptions';
import { PanelModel } from '../../state';
import { DataQuery, DataSourceApi, DataSourceSelectItem } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';

interface Props {
  panel: PanelModel;
}

export class PanelEditorQueries extends PureComponent<Props> {
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

  renderQueryOptions = (ds: DataSourceApi, data: PanelData) => {
    return <QueryOptions panel={panel} dataSource={ds} data={data} />;
  };

  render() {
    const { panel } = this.props;

    return (
      <QueriesTab
        dataSourceName={panel.datasource}
        queryRunner={panel.getQueryRunner()}
        queries={panel.targets}
        onQueriesChange={this.onQueriesChange}
        onDataSourceChange={this.onDataSourceChange}
        onRunQueries={this.onRunQueries}
        onOpenQueryInspector={this.onOpenQueryInspector}
      />
    );
  }
}
