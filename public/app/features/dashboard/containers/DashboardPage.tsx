// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Utils & Services
import locationUtil from 'app/core/utils/location_util';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { createErrorNotification } from 'app/core/copy/appNotification';

// Components
import { LoadingPlaceholder } from '@grafana/ui';

// Redux
import { updateLocation } from 'app/core/actions';
import { notifyApp } from 'app/core/actions';

// Types
import { StoreState } from 'app/types';
import { DashboardModel } from 'app/features/dashboard/state';

interface Props {
  panelId: string;
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  $scope: any;
  $injector: any;
  updateLocation: typeof updateLocation;
  notifyApp: typeof notifyApp;
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
    const { $injector, urlUid, urlType, urlSlug } = this.props;

    // handle old urls with no uid
    if (!urlUid && !(urlType === 'script' || urlType === 'snapshot')) {
      this.redirectToNewUrl();
      return;
    }

    const loaderSrv = $injector.get('dashboardLoaderSrv');
    const dashDTO = await loaderSrv.loadDashboard(urlType, urlSlug, urlUid);

    try {
      this.initDashboard(dashDTO);
    } catch (err) {
      this.props.notifyApp(createErrorNotification('Failed to init dashboard', err.toString()));
      console.log(err);
    }
  }

  redirectToNewUrl() {
    getBackendSrv()
      .getDashboardBySlug(this.props.urlSlug)
      .then(res => {
        if (res) {
          const url = locationUtil.stripBaseFromUrl(res.meta.url.replace('/d/', '/d-solo/'));
          this.props.updateLocation(url);
        }
      });
  }

  initDashboard(dashDTO: any) {
    const dashboard = new DashboardModel(dashDTO.dashboard, dashDTO.meta);

    // init services
    this.timeSrv.init(dashboard);
    this.annotationsSrv.init(dashboard);

    // template values service needs to initialize completely before
    // the rest of the dashboard can load
    this.variableSrv
      .init(dashboard)
      // template values failes are non fatal
      .catch(this.onInitFailed.bind(this, 'Templating init failed', false))
      // continue
      .finally(() => {
        this.dashboard = dashboard;
        this.dashboard.processRepeats();
        this.dashboard.updateSubmenuVisibility();
        this.dashboard.autoFitPanels(window.innerHeight);

        this.unsavedChangesSrv.init(dashboard, this.$scope);

        // TODO refactor ViewStateSrv
        this.$scope.dashboard = dashboard;
        this.dashboardViewState = this.dashboardViewStateSrv.create(this.$scope);

        this.keybindingSrv.setupDashboardBindings(this.$scope, dashboard);
        this.setWindowTitleAndTheme();

        appEvents.emit('dashboard-initialized', dashboard);
      })
      .catch(this.onInitFailed.bind(this, 'Dashboard init failed', true));

    this.setState({ dashboard });
  }

  render() {
    const { notFound, dashboard } = this.state;

    if (notFound) {
      return <div className="alert alert-error">Dashboard not found</div>;
    }

    if (!dashboard) {
      return <LoadingPlaceholder text="Loading dashboard" />;
    }

    return <div>title: {dashboard.title}</div>;
  }
}

const mapStateToProps = (state: StoreState) => ({
  urlUid: state.location.routeParams.uid,
  urlSlug: state.location.routeParams.slug,
  urlType: state.location.routeParams.type,
  panelId: state.location.query.panelId,
});

const mapDispatchToProps = {
  updateLocation,
  notifyApp,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardPage));
