// Libraries
import $ from 'jquery';
import React, { MouseEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import classNames from 'classnames';
// Services & Utils
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getMessageFromError } from 'app/core/utils/errors';
import { Branding } from 'app/core/components/Branding/Branding';

// Components
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { DashNav } from '../components/DashNav';
import { SubMenu } from '../components/SubMenu';
import { DashboardSettings } from '../components/DashboardSettings';
import { PanelEditor } from '../components/PanelEditor/PanelEditor';
import { CustomScrollbar, Alert, Portal } from '@grafana/ui';

// Redux
import { initDashboard } from '../state/initDashboard';
import { cleanUpDashboard } from '../state/reducers';
import { notifyApp, updateLocation } from 'app/core/actions';
// Types
import {
  AppNotificationSeverity,
  DashboardInitError,
  DashboardInitPhase,
  DashboardRouteInfo,
  StoreState,
} from 'app/types';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { InspectTab, PanelInspector } from '../components/Inspector/PanelInspector';

export interface Props {
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  editview?: string;
  urlPanelId?: string;
  urlFolderId?: string;
  urlEditPanel?: string;
  inspectPanelId?: string;
  $scope: any;
  $injector: any;
  routeInfo: DashboardRouteInfo;
  urlEdit: boolean;
  urlFullscreen: boolean;
  initPhase: DashboardInitPhase;
  isInitSlow: boolean;
  dashboard: DashboardModel | null;
  initError?: DashboardInitError;
  initDashboard: typeof initDashboard;
  cleanUpDashboard: typeof cleanUpDashboard;
  notifyApp: typeof notifyApp;
  updateLocation: typeof updateLocation;
  inspectTab?: InspectTab;
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
    this.props.initDashboard({
      $injector: this.props.$injector,
      $scope: this.props.$scope,
      urlSlug: this.props.urlSlug,
      urlUid: this.props.urlUid,
      urlType: this.props.urlType,
      urlFolderId: this.props.urlFolderId,
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
    const { dashboard, editview, urlEdit, urlFullscreen, urlPanelId, urlUid } = this.props;

    if (!dashboard) {
      return;
    }

    // if we just got dashboard update title
    if (!prevProps.dashboard) {
      document.title = dashboard.title + ' - ' + Branding.AppTitle;
    }

    // Due to the angular -> react url bridge we can ge an update here with new uid before the container unmounts
    // Can remove this condition after we switch to react router
    if (prevProps.urlUid !== urlUid) {
      return;
    }

    // handle animation states when opening dashboard settings
    if (!prevProps.editview && editview) {
      this.setState({ isSettingsOpening: true });
      setTimeout(() => {
        this.setState({ isSettingsOpening: false });
      }, 10);
    }

    // Sync url state with model
    if (urlFullscreen !== dashboard.meta.fullscreen || urlEdit !== dashboard.meta.isEditing) {
      if (urlPanelId && !isNaN(parseInt(urlPanelId, 10))) {
        this.onEnterFullscreen(dashboard, urlPanelId);
      } else {
        this.onLeaveFullscreen(dashboard);
      }
    }
  }

  onEnterFullscreen(dashboard: DashboardModel, urlPanelId: string) {
    const { urlEdit, urlFullscreen } = this.props;

    const panelId = parseInt(urlPanelId!, 10);
    dashboard;
    // need to expand parent row if this panel is inside a row
    dashboard.expandParentRowFor(panelId);

    const panel = dashboard.getPanelById(panelId);

    if (panel) {
      dashboard.setViewMode(panel, urlFullscreen, urlEdit);
      this.setState({
        isEditing: urlEdit && dashboard.meta.canEdit === true,
        isFullscreen: urlFullscreen,
        fullscreenPanel: panel,
        rememberScrollTop: this.state.scrollTop,
      });
      this.setPanelFullscreenClass(urlFullscreen);
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
    const {
      dashboard,
      editview,
      $injector,
      isInitSlow,
      initError,
      inspectPanelId,
      urlEditPanel,
      inspectTab,
      isNewEditorOpen,
    } = this.props;
    const { isSettingsOpening, isEditing, isFullscreen, scrollTop, updateScrollTop } = this.state;

    if (!dashboard) {
      if (isInitSlow) {
        return this.renderSlowInitState();
      }
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

    // Find the panel to inspect
    const inspectPanel = inspectPanelId ? dashboard.getPanelById(parseInt(inspectPanelId, 10)) : null;
    // find panel being edited
    const editPanel = urlEditPanel ? dashboard.getPanelById(parseInt(urlEditPanel, 10)) : null;

    // Only trigger render when the scroll has moved by 25
    const approximateScrollTop = Math.round(scrollTop / 25) * 25;

    return (
      <div className={classes}>
        <DashNav
          dashboard={dashboard}
          isEditing={isEditing}
          isFullscreen={isFullscreen}
          editview={editview}
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
            {editview && <DashboardSettings dashboard={dashboard} />}

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

        {inspectPanel && <PanelInspector dashboard={dashboard} panel={inspectPanel} selectedTab={inspectTab} />}
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
  urlUid: state.location.routeParams.uid,
  urlSlug: state.location.routeParams.slug,
  urlType: state.location.routeParams.type,
  editview: state.location.query.editview,
  urlPanelId: state.location.query.panelId,
  urlEditPanel: state.location.query.editPanel,
  urlFolderId: state.location.query.folderId,
  urlFullscreen: !!state.location.query.fullscreen,
  urlEdit: !!state.location.query.edit,
  inspectPanelId: state.location.query.inspect,
  initPhase: state.dashboard.initPhase,
  isInitSlow: state.dashboard.isInitSlow,
  initError: state.dashboard.initError,
  dashboard: state.dashboard.getModel() as DashboardModel,
  inspectTab: state.location.query.tab,
  isNewEditorOpen: state.panelEditorNew.isOpen,
});

const mapDispatchToProps = {
  initDashboard,
  cleanUpDashboard,
  notifyApp,
  updateLocation,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardPage));
