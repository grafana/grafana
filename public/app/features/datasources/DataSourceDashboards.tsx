import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import DashboardTable from './DashboardsTable';
import { NavModel, PluginDashboard } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
import { loadDataSource } from './state/actions';
import { loadPluginDashboards } from '../plugins/state/actions';

export interface Props {
  navModel: NavModel;
  dashboards: PluginDashboard[];
  pageId: number;
  loadDataSource: typeof loadDataSource;
  loadPluginDashboards: typeof loadPluginDashboards;
}

export class DataSourceDashboards extends PureComponent<Props> {
  async componentDidMount() {
    const { loadDataSource, pageId } = this.props;

    await loadDataSource(pageId);
    this.props.loadPluginDashboards();
  }

  onImport = (dashboard, state) => {};

  onRemove = dashboard => {};

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
  };
}

const mapDispatchToProps = {
  loadDataSource,
  loadPluginDashboards,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DataSourceDashboards));
