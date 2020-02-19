import $ from 'jquery';
import React, { MouseEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getMessageFromError } from 'app/core/utils/errors';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { DashNav } from '../components/DashNav';
import { SubMenu } from '../components/SubMenu';
import { DashboardSettings } from '../components/DashboardSettings';
import { PanelEditor } from '../components/PanelEditor/PanelEditor';
import { CustomScrollbar, Alert, Portal } from '@grafana/ui';
import { initDashboard } from '../state/initDashboard';
import { cleanUpDashboard } from '../state/reducers';
import { notifyApp } from 'app/core/actions';
import {
  AppNotificationSeverity,
  DashboardInitError,
  DashboardInitPhase,
  DashboardRouteInfo,
  StoreState,
} from 'app/types';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { PanelInspector } from '../components/Inspector/PanelInspector';
import { GrafanaRoute } from '../../../core/navigation/types';
import locationService from '../../../core/navigation/LocationService';

interface DashboardPageRouteProps {
  uid: string;
  slug: string;
  type: string;
}

interface DashboardPageQueryProps {
  editview: string;
  panelId: string;
  editPanel: string;
  folderId: string;
  fullscreen: boolean;
  edit: boolean;
  inspect: string;
  inspectTab: string;
}

export interface Props extends GrafanaRoute<DashboardPageRouteProps, DashboardPageQueryProps> {
  routeInfo: DashboardRouteInfo;
  initPhase: DashboardInitPhase;
  isInitSlow: boolean;
  dashboard: DashboardModel | null;
  initError?: DashboardInitError;
  initDashboard: typeof initDashboard;
  cleanUpDashboard: typeof cleanUpDashboard;
  notifyApp: typeof notifyApp;
  // updateLocation: typeof updateLocation;
  isNewEditorOpen?: boolean;
}

export interface State {
  isSettingsOpening: boolean;
  isEditing: boolean;
  isFullscreen: boolean;
  fullscreenPanel: PanelModel | null;
  scrollTop: number;
  updateScrollTop?: number;
  rememberScrollTop: number;
  showLoadingState: boolean;
}

export class DashboardPage extends PureComponent<Props, State> {
  state: State = {
    isSettingsOpening: false,
    isEditing: false,
    isFullscreen: false,
    showLoadingState: false,
    fullscreenPanel: null,
    scrollTop: 0,
    rememberScrollTop: 0,
  };

  async componentDidMount() {
    const {
      match: { params },
      query,
      initDashboard,
    } = this.props;
    console.log('DashboardPage did mount');
    initDashboard({
      $injector: this.props.$injector,
      // $scope: this.props.$scope,
      $scope: {},
      urlSlug: params.slug,
      urlUid: params.uid,
      urlType: params.type,
      urlFolderId: query.folderId,
      routeInfo: this.props.routeInfo,
      fixUrl: true,
    });
  }

  componentWillUnmount() {
    if (this.props.dashboard) {
      this.props.cleanUpDashboard();
      this.setPanelFullscreenClass(false);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const {
      dashboard,
      match: { params },
      query,
      initDashboard,
    } = this.props;

    // react-router can reuse this component for re-rendering dashboard page route
    // When passed route match changes, we need to re-initialise the dashboard page
    if (prevProps.match.params.uid !== params.uid) {
      this.props.cleanUpDashboard();
      this.setPanelFullscreenClass(false);
      initDashboard({
        $injector: this.props.$injector,
        // $scope: this.props.$scope,
        $scope: {},
        urlSlug: params.slug,
        urlUid: params.uid,
        urlType: params.type,
        urlFolderId: query.folderId,
        routeInfo: this.props.routeInfo,
        fixUrl: true,
      });
      return;
    }

    if (!dashboard) {
      return;
    }

    // if we just got dashboard update title
    if (!prevProps.dashboard) {
      document.title = dashboard.title + ' - Grafana';
    }

    // handle animation states when opening dashboard settings
    if (!prevProps.query.editview && query.editview) {
      this.setState({ isSettingsOpening: true });
      setTimeout(() => {
        this.setState({ isSettingsOpening: false });
      }, 10);
    }

    // Sync url state with model
    if (query.fullscreen !== dashboard.meta.fullscreen || query.edit !== dashboard.meta.isEditing) {
      if (query.panelId && !isNaN(parseInt(query.panelId, 10))) {
        this.onEnterFullscreen(dashboard, query.panelId);
      } else {
        this.onLeaveFullscreen(dashboard);
      }
    }
  }

  onEnterFullscreen(dashboard: DashboardModel, urlPanelId: string) {
    const { query } = this.props;

    const panelId = parseInt(urlPanelId!, 10);
    // need to expand parent row if this panel is inside a row
    dashboard.expandParentRowFor(panelId);

    const panel = dashboard.getPanelById(panelId);

    if (panel) {
      dashboard.setViewMode(panel, query.fullscreen, query.edit);

      this.setState({
        isEditing: query.edit && dashboard.meta.canEdit === true,
        isFullscreen: query.fullscreen,
        fullscreenPanel: panel,
        rememberScrollTop: this.state.scrollTop,
      });
      this.setPanelFullscreenClass(query.fullscreen);
    } else {
      this.handleFullscreenPanelNotFound(urlPanelId);
    }
  }

  onLeaveFullscreen(dashboard: DashboardModel) {
    if (this.state.fullscreenPanel) {
      dashboard.setViewMode(this.state.fullscreenPanel, false, false);
    }

    this.setState(
      {
        isEditing: false,
        isFullscreen: false,
        fullscreenPanel: null,
        updateScrollTop: this.state.rememberScrollTop,
      },
      this.triggerPanelsRendering.bind(this)
    );

    this.setPanelFullscreenClass(false);
  }

  triggerPanelsRendering() {
    try {
      this.props.dashboard!.render();
    } catch (err) {
      console.error(err);
      this.props.notifyApp(createErrorNotification(`Panel rendering error`, err));
    }
  }

  handleFullscreenPanelNotFound(urlPanelId: string) {
    // Panel not found
    this.props.notifyApp(createErrorNotification(`Panel with id ${urlPanelId} not found`));

    // Clear url state
    locationService().partial({
      edit: null,
      fullscreen: null,
      panelId: null,
    });
  }

  setPanelFullscreenClass = (isFullscreen: boolean) => {
    $('body').toggleClass('panel-in-fullscreen', isFullscreen);
  };

  setScrollTop = (e: MouseEvent<HTMLElement>): void => {
    const target = e.target as HTMLElement;
    this.setState({ scrollTop: target.scrollTop, updateScrollTop: null });
  };

  onAddPanel = () => {
    const { dashboard } = this.props;

    // Return if the "Add panel" exists already
    if (dashboard.panels.length > 0 && dashboard.panels[0].type === 'add-panel') {
      return;
    }

    dashboard.addPanel({
      type: 'add-panel',
      gridPos: { x: 0, y: 0, w: 12, h: 8 },
      title: 'Panel Title',
    });

    // scroll to top after adding panel
    this.setState({ updateScrollTop: 0 });
  };

  renderSlowInitState() {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__text">
          <i className="fa fa-spinner fa-spin" /> {this.props.initPhase}
        </div>
      </div>
    );
  }

  renderInitFailedState() {
    const { initError } = this.props;

    return (
      <div className="dashboard-loading">
        <Alert
          severity={AppNotificationSeverity.Error}
          title={initError.message}
          children={getMessageFromError(initError.error)}
        />
      </div>
    );
  }

  render() {
    const { dashboard, $injector, isInitSlow, initError, isNewEditorOpen, query } = this.props;

    const { isSettingsOpening, isEditing, isFullscreen, scrollTop, updateScrollTop } = this.state;

    if (!dashboard) {
      if (isInitSlow) {
        return this.renderSlowInitState();
      }
      return null;
    }

    const classes = classNames({
      'dashboard-page--settings-opening': isSettingsOpening,
      'dashboard-page--settings-open': !isSettingsOpening && query.editview,
    });

    const gridWrapperClasses = classNames({
      'dashboard-container': true,
      'dashboard-container--has-submenu': dashboard.meta.submenuEnabled,
    });

    // Find the panel to inspect
    const inspectPanel = query.inspect ? dashboard.getPanelById(parseInt(query.inspect, 10)) : null;
    // find panel being edited

    const editPanel = query.editPanel ? dashboard.getPanelById(parseInt(query.editPanel, 10)) : null;

    // Only trigger render when the scroll has moved by 25
    const approximateScrollTop = Math.round(scrollTop / 25) * 25;

    return (
      <div className={classes}>
        <DashNav
          dashboard={dashboard}
          isEditing={isEditing}
          isFullscreen={isFullscreen}
          editview={query.editview}
          $injector={$injector}
          onAddPanel={this.onAddPanel}
        />
        <div className="scroll-canvas scroll-canvas--dashboard">
          <CustomScrollbar
            autoHeightMin="100%"
            setScrollTop={this.setScrollTop}
            scrollTop={updateScrollTop}
            updateAfterMountMs={500}
            className="custom-scrollbar--page"
          >
            {query.editview && <DashboardSettings dashboard={dashboard} />}

            {initError && this.renderInitFailedState()}

            <div className={gridWrapperClasses}>
              <SubMenu dashboard={dashboard} />
              <DashboardGrid
                dashboard={dashboard}
                isEditing={isEditing}
                isFullscreen={isFullscreen}
                isNewEditorOpen={isNewEditorOpen}
                scrollTop={approximateScrollTop}
              />
            </div>
          </CustomScrollbar>
        </div>

        {inspectPanel && <PanelInspector dashboard={dashboard} panel={inspectPanel} selectedTab={query.inspectTab} />}
        {editPanel && (
          <Portal>
            <PanelEditor dashboard={dashboard} sourcePanel={editPanel} />
          </Portal>
        )}
      </div>
    );
  }
}

export const mapStateToProps = (state: StoreState) => ({
  initPhase: state.dashboard.initPhase,
  isInitSlow: state.dashboard.isInitSlow,
  initError: state.dashboard.initError,
  dashboard: state.dashboard.getModel() as DashboardModel,
  isNewEditorOpen: state.panelEditorNew.isOpen,
});

const mapDispatchToProps = {
  initDashboard,
  cleanUpDashboard,
  notifyApp,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardPage));
