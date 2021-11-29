// Libraries
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

// Components
import Page from 'app/core/components/Page/Page';
import DashboardTable from './DashboardsTable';

// Actions & Selectors
import { getNavModel } from 'app/core/selectors/navModel';
import { loadDataSource } from './state/actions';
import { loadPluginDashboards } from '../plugins/admin/state/actions';
import { importDashboard, removeDashboard } from '../dashboard/state/actions';
import { getDataSource } from './state/selectors';

// Types
import { PluginDashboard, StoreState } from 'app/types';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

function mapStateToProps(state: StoreState, props: OwnProps) {
  const dataSourceId = props.match.params.uid;

  return {
    navModel: getNavModel(state.navIndex, `datasource-dashboards-${dataSourceId}`),
    dashboards: state.plugins.dashboards,
    dataSource: getDataSource(state.dataSources, dataSourceId),
    isLoading: state.plugins.isLoadingPluginDashboards,
    dataSourceId,
  };
}

const mapDispatchToProps = {
  importDashboard,
  loadDataSource,
  loadPluginDashboards,
  removeDashboard,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export class DataSourceDashboards extends PureComponent<Props> {
  async componentDidMount() {
    const { loadDataSource, dataSourceId } = this.props;
    await loadDataSource(dataSourceId);
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
            onRemove={(dashboard) => this.onRemove(dashboard)}
          />
        </Page.Contents>
      </Page>
    );
  }
}

export default connector(DataSourceDashboards);
