// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Utils & Services
import appEvents from 'app/core/app_events';

// Components
import { DashboardPanel } from '../dashgrid/DashboardPanel';

// Types
import { StoreState } from 'app/types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';

interface Props {
  panelId: string;
  uid?: string;
  slug?: string;
  type?: string;
  $scope: any;
  $injector: any;
}

interface State {
  panel: PanelModel | null;
  dashboard: DashboardModel | null;
  notFound: boolean;
}

export class SoloPanelPage extends Component<Props, State> {

  state: State = {
    panel: null,
    dashboard: null,
    notFound: false,
  };

  componentDidMount() {
    const { $injector, $scope, uid } = this.props;

    const dashboardLoaderSrv = $injector.get('dashboardLoaderSrv');

    // subscribe to event to know when dashboard controller is done with inititalization
    appEvents.on('dashboard-initialized', this.onDashoardInitialized);

    dashboardLoaderSrv.loadDashboard('', '', uid).then(result => {
      result.meta.soloMode = true;
      $scope.initDashboard(result, $scope);
    });
  }

  onDashoardInitialized = () => {
    const { $scope, panelId } = this.props;

    const dashboard: DashboardModel = $scope.dashboard;
    const panel = dashboard.getPanelById(parseInt(panelId, 10));

    if (!panel) {
      this.setState({ notFound: true });
      return;
    }

    this.setState({ dashboard, panel });
  };

  render() {
    const { panelId } = this.props;
    const { notFound, panel, dashboard } = this.state;

    if (notFound) {
      return (
        <div className="alert alert-error">
          Panel with id { panelId } not found
        </div>
      );
    }

    if (!panel) {
      return <div>Loading & initializing dashboard</div>;
    }

    return (
      <div className="panel-solo">
        <DashboardPanel dashboard={dashboard} panel={panel} isEditing={false} isFullscreen={false} />
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  uid: state.location.routeParams.uid,
  slug: state.location.routeParams.slug,
  type: state.location.routeParams.type,
  panelId: state.location.query.panelId
});

const mapDispatchToProps = {
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(SoloPanelPage));
