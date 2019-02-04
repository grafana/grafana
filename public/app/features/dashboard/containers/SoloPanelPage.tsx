// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Utils & Services
import appEvents from 'app/core/app_events';
import locationUtil from 'app/core/utils/location_util';
import { getBackendSrv } from 'app/core/services/backend_srv';

// Components
import { DashboardPanel } from '../dashgrid/DashboardPanel';

// Redux
import { updateLocation } from 'app/core/actions';

// Types
import { StoreState } from 'app/types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';

interface Props {
  panelId: string;
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  $scope: any;
  $injector: any;
  updateLocation: typeof updateLocation;
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
    const { $injector, $scope, urlUid, urlType, urlSlug } = this.props;

    // handle old urls with no uid
    if (!urlUid && !(urlType === 'script' || urlType === 'snapshot')) {
      this.redirectToNewUrl();
      return;
    }

    const dashboardLoaderSrv = $injector.get('dashboardLoaderSrv');

    // subscribe to event to know when dashboard controller is done with inititalization
    appEvents.on('dashboard-initialized', this.onDashoardInitialized);

    dashboardLoaderSrv.loadDashboard(urlType, urlSlug, urlUid).then(result => {
      result.meta.soloMode = true;
      $scope.initDashboard(result, $scope);
    });
  }

  redirectToNewUrl() {
    getBackendSrv().getDashboardBySlug(this.props.urlSlug).then(res => {
      if (res) {
        const url = locationUtil.stripBaseFromUrl(res.meta.url.replace('/d/', '/d-solo/'));
        this.props.updateLocation(url);
      }
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
  urlUid: state.location.routeParams.uid,
  urlSlug: state.location.routeParams.slug,
  urlType: state.location.routeParams.type,
  panelId: state.location.query.panelId
});

const mapDispatchToProps = {
  updateLocation
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(SoloPanelPage));
