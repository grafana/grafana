// Libraries
import $ from 'jquery';
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import classNames from 'classnames';

// Services & Utils
import { createErrorNotification } from 'app/core/copy/appNotification';

// Components
import { LoadingPlaceholder } from '@grafana/ui';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { DashNav } from '../components/DashNav';
import { SubMenu } from '../components/SubMenu';
import { DashboardSettings } from '../components/DashboardSettings';

// Redux
import { initDashboard } from '../state/initDashboard';
import { setDashboardModel } from '../state/actions';
import { updateLocation } from 'app/core/actions';
import { notifyApp } from 'app/core/actions';

// Types
import { StoreState, DashboardLoadingState, DashboardRouteInfo } from 'app/types';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

interface Props {
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  editview?: string;
  urlPanelId?: string;
  urlFolderId?: string;
  $scope: any;
  $injector: any;
  routeInfo: DashboardRouteInfo;
  urlEdit: boolean;
  urlFullscreen: boolean;
  loadingState: DashboardLoadingState;
  dashboard: DashboardModel;
  initDashboard: typeof initDashboard;
  setDashboardModel: typeof setDashboardModel;
  notifyApp: typeof notifyApp;
  updateLocation: typeof updateLocation;
}

interface State {
  isSettingsOpening: boolean;
  isEditing: boolean;
  isFullscreen: boolean;
  fullscreenPanel: PanelModel | null;
}

export class DashboardPage extends PureComponent<Props, State> {
  state: State = {
    isSettingsOpening: false,
    isEditing: false,
    isFullscreen: false,
    fullscreenPanel: null,
  };

  async componentDidMount() {
    this.props.initDashboard({
      $injector: this.props.$injector,
      $scope: this.props.$scope,
      urlSlug: this.props.urlSlug,
      urlUid: this.props.urlUid,
      urlType: this.props.urlType,
      urlFolderId: this.props.urlFolderId,
      routeInfo: this.props.routeInfo,
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { dashboard, editview, urlEdit, urlFullscreen, urlPanelId } = this.props;

    if (!dashboard) {
      return;
    }

    // handle animation states when opening dashboard settings
    if (!prevProps.editview && editview) {
      this.setState({ isSettingsOpening: true });
      setTimeout(() => {
        this.setState({ isSettingsOpening: false });
      }, 10);
    }

    // // when dashboard has loaded subscribe to somme events
    // if (prevProps.dashboard === null) {
    //   // set initial fullscreen class state
    //   this.setPanelFullscreenClass();
    // }

    // Sync url state with model
    if (urlFullscreen !== dashboard.meta.isFullscreen || urlEdit !== dashboard.meta.isEditing) {
      // entering fullscreen/edit mode
      if (urlPanelId) {
        const panel = dashboard.getPanelById(parseInt(urlPanelId, 10));

        if (panel) {
          dashboard.setViewMode(panel, urlFullscreen, urlEdit);
          this.setState({ isEditing: urlEdit, isFullscreen: urlFullscreen, fullscreenPanel: panel });
        } else {
          this.handleFullscreenPanelNotFound(urlPanelId);
        }
      } else {
        // handle leaving fullscreen mode
        if (this.state.fullscreenPanel) {
          dashboard.setViewMode(this.state.fullscreenPanel, urlFullscreen, urlEdit);
        }
        this.setState({ isEditing: urlEdit, isFullscreen: urlFullscreen, fullscreenPanel: null });
      }

      this.setPanelFullscreenClass(urlFullscreen);
    }
  }

  handleFullscreenPanelNotFound(urlPanelId: string) {
    // Panel not found
    this.props.notifyApp(createErrorNotification(`Panel with id ${urlPanelId} not found`));
    // Clear url state
    this.props.updateLocation({
      query: {
        edit: null,
        fullscreen: null,
        panelId: null,
      },
      partial: true,
    });
  }

  setPanelFullscreenClass(isFullscreen: boolean) {
    $('body').toggleClass('panel-in-fullscreen', isFullscreen);
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
    const { isEditing, isFullscreen } = this.state;

    const classes = classNames({
      'dashboard-container': true,
      'dashboard-container--has-submenu': dashboard.meta.submenuEnabled,
    });

    return (
      <div className="scroll-canvas scroll-canvas--dashboard">
        {dashboard && editview && <DashboardSettings dashboard={dashboard} />}

        <div className={classes}>
          <DashboardGrid dashboard={dashboard} isEditing={isEditing} isFullscreen={isFullscreen} />
        </div>
      </div>
    );
  }

  render() {
    const { dashboard, editview, $injector } = this.props;
    const { isSettingsOpening, isEditing, isFullscreen } = this.state;

    if (!dashboard) {
      return null;
    }

    const classes = classNames({
      'dashboard-page--settings-opening': isSettingsOpening,
      'dashboard-page--settings-open': !isSettingsOpening && editview,
    });

    const gridWrapperClasses = classNames({
      'dashboard-container': true,
      'dashboard-container--has-submenu': dashboard.meta.submenuEnabled,
    });
    return (
      <div className={classes}>
        <DashNav
          dashboard={dashboard}
          isEditing={isEditing}
          isFullscreen={isFullscreen}
          editview={editview}
          $injector={$injector}
        />
        <div className="scroll-canvas scroll-canvas--dashboard">
          {dashboard && editview && <DashboardSettings dashboard={dashboard} />}

          <div className={gridWrapperClasses}>
            {dashboard.meta.submenuEnabled && <SubMenu dashboard={dashboard} />}
            <DashboardGrid dashboard={dashboard} isEditing={isEditing} isFullscreen={isFullscreen} />
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  urlUid: state.location.routeParams.uid,
  urlSlug: state.location.routeParams.slug,
  urlType: state.location.routeParams.type,
  editview: state.location.query.editview,
  urlPanelId: state.location.query.panelId,
  urlFolderId: state.location.query.folderId,
  urlFullscreen: state.location.query.fullscreen === true,
  urlEdit: state.location.query.edit === true,
  loadingState: state.dashboard.loadingState,
  dashboard: state.dashboard.model as DashboardModel,
});

const mapDispatchToProps = {
  initDashboard,
  setDashboardModel,
  notifyApp,
  updateLocation,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardPage));
