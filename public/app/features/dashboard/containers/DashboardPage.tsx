// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Components
import { LoadingPlaceholder } from '@grafana/ui';

// Redux
import { initDashboard } from '../state/initDashboard';

// Types
import { StoreState } from 'app/types';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardLoadingState } from 'app/types/dashboard';

interface Props {
  panelId: string;
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  $scope: any;
  $injector: any;
  initDashboard: typeof initDashboard;
  loadingState: DashboardLoadingState;
  dashboard: DashboardModel;
}

interface State {
  dashboard: DashboardModel | null;
  notFound: boolean;
}

export class DashboardPage extends Component<Props, State> {
  state: State = {
    dashboard: null,
    notFound: false,
  };

  async componentDidMount() {
    this.props.initDashboard({
      injector: this.props.$injector,
      scope: this.props.$scope,
      urlSlug: this.props.urlSlug,
      urlUid: this.props.urlUid,
      urlType: this.props.urlType,
    })

    // const { $injector, urlUid, urlType, urlSlug } = this.props;
    //
    // // handle old urls with no uid
    // if (!urlUid && !(urlType === 'script' || urlType === 'snapshot')) {
    //   this.redirectToNewUrl();
    //   return;
    // }
    //
    // const loaderSrv = $injector.get('dashboardLoaderSrv');
    // const dashDTO = await loaderSrv.loadDashboard(urlType, urlSlug, urlUid);
    //
    // try {
    //   this.initDashboard(dashDTO);
    // } catch (err) {
    //   this.props.notifyApp(createErrorNotification('Failed to init dashboard', err.toString()));
    //   console.log(err);
    // }
  }

  // redirectToNewUrl() {
  //   getBackendSrv()
  //     .getDashboardBySlug(this.props.urlSlug)
  //     .then(res => {
  //       if (res) {
  //         const url = locationUtil.stripBaseFromUrl(res.meta.url.replace('/d/', '/d-solo/'));
  //         this.props.updateLocation(url);
  //       }
  //     });
  // }
  //
  // initDashboard(dashDTO: any) {
  //   const dashboard = new DashboardModel(dashDTO.dashboard, dashDTO.meta);
  //   this.setState({ dashboard });
  // }

  render() {
    const { loadingState, dashboard } = this.props;

    if (!dashboard) {
      return <LoadingPlaceholder text={loadingState.toString()} />;
    }

    return <div>title: {dashboard.title}</div>;
  }
}

const mapStateToProps = (state: StoreState) => ({
  urlUid: state.location.routeParams.uid,
  urlSlug: state.location.routeParams.slug,
  urlType: state.location.routeParams.type,
  panelId: state.location.query.panelId,
  loadingState: state.dashboard.loadingState,
  dashboard: state.dashboard as DashboardModel,
});

const mapDispatchToProps = {
  initDashboard
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardPage));
