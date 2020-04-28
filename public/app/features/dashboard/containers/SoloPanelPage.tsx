// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Components
import { DashboardPanel } from '../dashgrid/DashboardPanel';

// Redux
import { initDashboard } from '../state/initDashboard';

// Types
import { StoreState, DashboardRouteInfo } from 'app/types';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';

interface Props {
  urlPanelId: string;
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  $scope: any;
  $injector: any;
  routeInfo: DashboardRouteInfo;
  initDashboard: typeof initDashboard;
  dashboard: DashboardModel | null;
}

interface State {
  panel: PanelModel | null;
  notFound: boolean;
}

export class SoloPanelPage extends Component<Props, State> {
  state: State = {
    panel: null,
    notFound: false,
  };

  componentDidMount() {
    const { $injector, $scope, urlUid, urlType, urlSlug, routeInfo } = this.props;

    this.props.initDashboard({
      $injector: $injector,
      $scope: $scope,
      urlSlug: urlSlug,
      urlUid: urlUid,
      urlType: urlType,
      routeInfo: routeInfo,
      fixUrl: false,
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { urlPanelId, dashboard } = this.props;

    if (!dashboard) {
      return;
    }

    // we just got the dashboard!
    if (!prevProps.dashboard) {
      const panelId = parseInt(urlPanelId, 10);

      // need to expand parent row if this panel is inside a row
      dashboard.expandParentRowFor(panelId);

      const panel = dashboard.getPanelById(panelId);

      if (!panel) {
        this.setState({ notFound: true });
        return;
      }

      this.setState({ panel });
    }
  }

  render() {
    const { urlPanelId, dashboard } = this.props;
    const { notFound, panel } = this.state;

    if (notFound) {
      return <div className="alert alert-error">Panel with id {urlPanelId} not found</div>;
    }

    if (!panel || !dashboard) {
      return <div>Loading & initializing dashboard</div>;
    }

    return (
      <div className="panel-solo">
        <DashboardPanel dashboard={dashboard} panel={panel} isEditing={false} isViewing={false} isInView={true} />
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  urlUid: state.location.routeParams.uid,
  urlSlug: state.location.routeParams.slug,
  urlType: state.location.routeParams.type,
  urlPanelId: state.location.query.panelId,
  dashboard: state.dashboard.getModel() as DashboardModel,
});

const mapDispatchToProps = {
  initDashboard,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(SoloPanelPage));
