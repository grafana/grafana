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
import { DashboardSettings } from '../components/DashboardSettings';
import { PanelEditor } from '../components/PanelEditor/PanelEditor';
import { Alert, CustomScrollbar, Icon } from '@grafana/ui';
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
import { getConfig } from '../../../core/config';
import { SubMenu } from '../components/SubMenu/SubMenu';

export interface Props {
  urlUid?: string;
  urlSlug?: string;
  urlType?: string;
  editview?: string;
  urlPanelId?: string;
  urlFolderId?: string;
  inspectPanelId?: string;
  $scope: any;
  $injector: any;
  routeInfo: DashboardRouteInfo;
  urlEditPanelId?: string;
  urlViewPanelId?: string;
  initPhase: DashboardInitPhase;
  isInitSlow: boolean;
  dashboard: DashboardModel | null;
  initError?: DashboardInitError;
  initDashboard: typeof initDashboard;
  cleanUpDashboard: typeof cleanUpDashboard;
  notifyApp: typeof notifyApp;
  updateLocation: typeof updateLocation;
  inspectTab?: InspectTab;
  isPanelEditorOpen?: boolean;
}

export interface State {
  editPanel: PanelModel | null;
  viewPanel: PanelModel | null;
  scrollTop: number;
  updateScrollTop?: number;
  rememberScrollTop: number;
  showLoadingState: boolean;
}

export class DashboardPage extends PureComponent<Props, State> {
  state: State = {
    editPanel: null,
    viewPanel: null,
    showLoadingState: false,
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
    const { dashboard, urlEditPanelId, urlViewPanelId, urlUid } = this.props;
    const { editPanel, viewPanel } = this.state;

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

    // entering edit mode
    if (!editPanel && urlEditPanelId) {
      this.getPanelByIdFromUrlParam(urlEditPanelId, panel => {
        this.setState({ editPanel: panel });
      });
    }

    // leaving edit mode
    if (editPanel && !urlEditPanelId) {
      this.setState({ editPanel: null });
    }

    // entering view mode
    if (!viewPanel && urlViewPanelId) {
      this.getPanelByIdFromUrlParam(urlViewPanelId, panel => {
        this.setPanelFullscreenClass(true);
        dashboard.initViewPanel(panel);
        this.setState({
          viewPanel: panel,
          rememberScrollTop: this.state.scrollTop,
        });
      });
    }

    // leaving view mode
    if (viewPanel && !urlViewPanelId) {
      this.setPanelFullscreenClass(false);
      dashboard.exitViewPanel(viewPanel);
      this.setState(
        { viewPanel: null, updateScrollTop: this.state.rememberScrollTop },
        this.triggerPanelsRendering.bind(this)
      );
    }
  }

  getPanelByIdFromUrlParam(urlPanelId: string, callback: (panel: PanelModel) => void) {
    const { dashboard } = this.props;

    const panelId = parseInt(urlPanelId!, 10);
    dashboard!.expandParentRowFor(panelId);
    const panel = dashboard!.getPanelById(panelId);

    if (!panel) {
      // Panel not found
      this.props.notifyApp(createErrorNotification(`Panel with id ${urlPanelId} not found`));
      // Clear url state
      this.props.updateLocation({
        query: {
          editPanel: null,
          viewPanel: null,
        },
        partial: true,
      });
      return;
    }

    callback(panel);
  }

  triggerPanelsRendering() {
    try {
      this.props.dashboard!.render();
    } catch (err) {
      console.error(err);
      this.props.notifyApp(createErrorNotification(`Panel rendering error`, err));
    }
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
          <Icon name="fa fa-spinner" className="fa-spin" /> {this.props.initPhase}
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

  getInspectPanel() {
    const { dashboard, inspectPanelId } = this.props;
    if (!dashboard || !inspectPanelId) {
      return null;
    }

    const inspectPanel = dashboard.getPanelById(parseInt(inspectPanelId, 10));

    // cannot inspect panels plugin is not already loaded
    if (!inspectPanel) {
      return null;
    }

    return inspectPanel;
  }

  render() {
    const {
      dashboard,
      editview,
      $injector,
      isInitSlow,
      initError,
      inspectTab,
      isPanelEditorOpen,
      updateLocation,
    } = this.props;

    const { editPanel, viewPanel, scrollTop, updateScrollTop } = this.state;
    const { featureToggles } = getConfig();

    if (!dashboard) {
      if (isInitSlow) {
        return this.renderSlowInitState();
      }
      return null;
    }

    const gridWrapperClasses = classNames({
      'dashboard-container': true,
      'dashboard-container--has-submenu': dashboard.meta.submenuEnabled,
    });

    // Only trigger render when the scroll has moved by 25
    const approximateScrollTop = Math.round(scrollTop / 25) * 25;
    const inspectPanel = this.getInspectPanel();

    return (
      <div>
        <DashNav dashboard={dashboard} isFullscreen={!!viewPanel} $injector={$injector} onAddPanel={this.onAddPanel} />
        <div className="scroll-canvas scroll-canvas--dashboard">
          <CustomScrollbar
            autoHeightMin="100%"
            setScrollTop={this.setScrollTop}
            scrollTop={updateScrollTop}
            updateAfterMountMs={500}
            className="custom-scrollbar--page"
          >
            {initError && this.renderInitFailedState()}

            <div className={gridWrapperClasses}>
              {!featureToggles.newVariables && <SubMenu dashboard={dashboard} />}
              {!editPanel && featureToggles.newVariables && <SubMenu dashboard={dashboard} />}
              <DashboardGrid
                dashboard={dashboard}
                viewPanel={viewPanel}
                editPanel={editPanel}
                scrollTop={approximateScrollTop}
                isPanelEditorOpen={isPanelEditorOpen}
              />
            </div>
          </CustomScrollbar>
        </div>

        {inspectPanel && <PanelInspector dashboard={dashboard} panel={inspectPanel} defaultTab={inspectTab} />}
        {editPanel && <PanelEditor dashboard={dashboard} sourcePanel={editPanel} />}
        {editview && <DashboardSettings dashboard={dashboard} updateLocation={updateLocation} />}
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
  urlFolderId: state.location.query.folderId,
  urlEditPanelId: state.location.query.editPanel,
  urlViewPanelId: state.location.query.viewPanel,
  inspectPanelId: state.location.query.inspect,
  initPhase: state.dashboard.initPhase,
  isInitSlow: state.dashboard.isInitSlow,
  initError: state.dashboard.initError,
  dashboard: state.dashboard.getModel() as DashboardModel,
  inspectTab: state.location.query.inspectTab,
  isPanelEditorOpen: state.panelEditor.isOpen,
});

const mapDispatchToProps = {
  initDashboard,
  cleanUpDashboard,
  notifyApp,
  updateLocation,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardPage));
