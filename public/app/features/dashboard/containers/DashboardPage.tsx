// Libraries
import $ from 'jquery';
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import classNames from 'classnames';

// Components
import { LoadingPlaceholder } from '@grafana/ui';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { DashNav } from '../components/DashNav';
import { DashboardSettings } from '../components/DashboardSettings';

// Redux
import { initDashboard } from '../state/initDashboard';
import { setDashboardModel } from '../state/actions';

// Types
import { StoreState } from 'app/types';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardLoadingState } from 'app/types/dashboard';

interface Props {
  panelId: string;
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  editview: string;
  $scope: any;
  $injector: any;
  initDashboard: typeof initDashboard;
  setDashboardModel: typeof setDashboardModel;
  loadingState: DashboardLoadingState;
  dashboard: DashboardModel;
}

interface State {
  isSettingsOpening: boolean;
}

export class DashboardPage extends PureComponent<Props, State> {
  state: State = {
    isSettingsOpening: false,
    isSettingsOpen: false,
  };

  async componentDidMount() {
    this.props.initDashboard({
      injector: this.props.$injector,
      scope: this.props.$scope,
      urlSlug: this.props.urlSlug,
      urlUid: this.props.urlUid,
      urlType: this.props.urlType,
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { dashboard, editview } = this.props;

    // when dashboard has loaded subscribe to somme events
    if (prevProps.dashboard === null && dashboard) {
      dashboard.events.on('view-mode-changed', this.onViewModeChanged);

      // set initial fullscreen class state
      this.setPanelFullscreenClass();
    }

    if (!prevProps.editview && editview) {
      this.setState({ isSettingsOpening: true });
      setTimeout(() => {
        this.setState({ isSettingsOpening: false});
      }, 10);
    }
  }

  onViewModeChanged = () => {
    this.setPanelFullscreenClass();
  };

  setPanelFullscreenClass() {
    $('body').toggleClass('panel-in-fullscreen', this.props.dashboard.meta.fullscreen === true);
  }

  componentWillUnmount() {
    if (this.props.dashboard) {
      this.props.dashboard.destroy();
      this.props.setDashboardModel(null);
    }
  }

  renderLoadingState() {
    return <LoadingPlaceholder text="Loading" />;
  }

  renderDashboard() {
    const { dashboard, editview } = this.props;

    const classes = classNames({
      'dashboard-container': true,
      'dashboard-container--has-submenu': dashboard.meta.submenuEnabled
    });

    return (
      <div className="scroll-canvas scroll-canvas--dashboard">
        {dashboard && editview && <DashboardSettings dashboard={dashboard} />}

        <div className={classes}>
          <DashboardGrid dashboard={dashboard} />
        </div>
      </div>
    );
  }

  render() {
    const { dashboard, editview } = this.props;
    const { isSettingsOpening } = this.state;

    const classes = classNames({
      'dashboard-page--settings-opening': isSettingsOpening,
      'dashboard-page--settings-open': !isSettingsOpening && editview,
    });

    return (
      <div className={classes}>
        <DashNav dashboard={dashboard} />
        {!dashboard && this.renderLoadingState()}
        {dashboard && this.renderDashboard()}
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  urlUid: state.location.routeParams.uid,
  urlSlug: state.location.routeParams.slug,
  urlType: state.location.routeParams.type,
  panelId: state.location.query.panelId,
  editview: state.location.query.editview,
  loadingState: state.dashboard.loadingState,
  dashboard: state.dashboard.model as DashboardModel,
});

const mapDispatchToProps = {
  initDashboard,
  setDashboardModel
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardPage));
