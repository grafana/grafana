// Libraries
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Components
import Page from 'app/core/components/Page/Page';
import DashboardTable from './DashboardsTable';

// Actions & Selectors
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
import { loadDataSource } from './state/actions';
import { loadPluginDashboards } from '../plugins/state/actions';
import { importDashboard, removeDashboard } from '../dashboard/state/actions';
import { getDataSource } from './state/selectors';

// Types
import { PluginDashboard, StoreState } from 'app/types';
import { DataSourceSettings } from '@grafana/data';
import { NavModel } from '@grafana/data';

export interface Props {
  navModel: NavModel;
  dashboards: PluginDashboard[];
  dataSource: DataSourceSettings;
  pageId: number;
  importDashboard: typeof importDashboard;
  loadDataSource: typeof loadDataSource;
  loadPluginDashboards: typeof loadPluginDashboards;
  removeDashboard: typeof removeDashboard;
  isLoading: boolean;
}

export class DataSourceDashboards extends PureComponent<Props> {
  async componentDidMount() {
    const { loadDataSource, pageId } = this.props;

    await loadDataSource(pageId);
    this.props.loadPluginDashboards();
  }

  onImport = (dashboard: PluginDashboard, overwrite: boolean) => {
    const { dataSource, importDashboard } = this.props;
    const data: any = {
      pluginId: dashboard.pluginId,
      path: dashboard.path,
      overwrite,
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
    const { dashboards, navModel, isLoading } = this.props;
    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <DashboardTable
            dashboards={dashboards}
            onImport={(dashboard, overwrite) => this.onImport(dashboard, overwrite)}
            onRemove={dashboard => this.onRemove(dashboard)}
          />
        </Page.Contents>
      </Page>
    );
  }
}

function mapStateToProps(state: StoreState) {
  const pageId = getRouteParamsId(state.location);
  return {
    navModel: getNavModel(state.navIndex, `datasource-dashboards-${pageId}`),
    pageId: pageId,
    dashboards: state.plugins.dashboards,
    dataSource: getDataSource(state.dataSources, pageId),
    isLoading: state.plugins.isLoadingPluginDashboards,
  };
}

const mapDispatchToProps = {
  importDashboard,
  loadDataSource,
  loadPluginDashboards,
  removeDashboard,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(DataSourceDashboards)
);
