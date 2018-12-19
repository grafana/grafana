import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import DashboardTable from './DashboardsTable';
import { DataSource, NavModel, PluginDashboard } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
import { loadDataSource } from './state/actions';
import { loadPluginDashboards } from '../plugins/state/actions';
import { importDashboard, removeDashboard } from '../dashboard/state/actions';
import { getDataSource } from './state/selectors';

export interface Props {
  navModel: NavModel;
  dashboards: PluginDashboard[];
  dataSource: DataSource;
  pageId: number;
  importDashboard: typeof importDashboard;
  loadDataSource: typeof loadDataSource;
  loadPluginDashboards: typeof loadPluginDashboards;
  removeDashboard: typeof removeDashboard;
}

export class DataSourceDashboards extends PureComponent<Props> {
  async componentDidMount() {
    const { loadDataSource, pageId } = this.props;

    await loadDataSource(pageId);
    this.props.loadPluginDashboards();
  }

  onImport = (dashboard: PluginDashboard, overwrite: boolean) => {
    const { dataSource, importDashboard } = this.props;
    const data = {
      pluginId: dashboard.pluginId,
      path: dashboard.path,
      overwrite: overwrite,
      inputs: [],
    };

    if (dataSource) {
      data.inputs.push({
        name: '*',
        type: 'datasource',
        pluginId: dataSource.type,
        value: dataSource.name,
      });
    }

    importDashboard(data, dashboard.title);
  };

  onRemove = (dashboard: PluginDashboard) => {
    this.props.removeDashboard(dashboard.importedUri);
  };

  render() {
    const { dashboards, navModel } = this.props;
    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <DashboardTable
            dashboards={dashboards}
            onImport={(dashboard, overwrite) => this.onImport(dashboard, overwrite)}
            onRemove={dashboard => this.onRemove(dashboard)}
          />
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const pageId = getRouteParamsId(state.location);

  return {
    navModel: getNavModel(state.navIndex, `datasource-dashboards-${pageId}`),
    pageId: pageId,
    dashboards: state.plugins.dashboards,
    dataSource: getDataSource(state.dataSources, pageId),
  };
}

const mapDispatchToProps = {
  importDashboard,
  loadDataSource,
  loadPluginDashboards,
  removeDashboard,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DataSourceDashboards));
