import React, { PureComponent } from 'react';
import { QueriesTab } from 'app/features/query/components/QueriesTab';
import { DashboardModel, PanelModel } from '../../state';
import { DataQuery, DataSourceSelectItem } from '@grafana/data';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class PanelEditorQueries extends PureComponent<Props> {
  onDataSourceChange = (ds: DataSourceSelectItem, queries: DataQuery[]) => {
    const { panel } = this.props;

    panel.datasource = ds.value;
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

  render() {
    const { panel, dashboard } = this.props;

    return (
      <QueriesTab
        datasourceName={panel.datasource}
        queryRunner={panel.getQueryRunner()}
        queries={panel.targets}
        onQueriesChange={this.onQueriesChange}
        onDataSourceChange={this.onDataSourceChange}
        onRunQueries={this.onRunQueries}
        dashboard={dashboard}
      />
    );
  }
}
