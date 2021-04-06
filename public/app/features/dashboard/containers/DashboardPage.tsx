import $ from 'jquery';
import React, { MouseEvent, PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { getLegacyAngularInjector, locationService } from '@grafana/runtime';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, Button, CustomScrollbar, HorizontalGroup, Spinner, VerticalGroup } from '@grafana/ui';

import { createErrorNotification } from 'app/core/copy/appNotification';
import { getMessageFromError } from 'app/core/utils/errors';
import { Branding } from 'app/core/components/Branding/Branding';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { DashNav } from '../components/DashNav';
import { DashboardSettings } from '../components/DashboardSettings';
import { PanelEditor } from '../components/PanelEditor/PanelEditor';
import { initDashboard } from '../state/initDashboard';
import { notifyApp } from 'app/core/actions';
import { AppNotificationSeverity, DashboardInitError, DashboardInitPhase, KioskMode, StoreState } from 'app/types';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { PanelInspector } from '../components/Inspector/PanelInspector';
import { SubMenu } from '../components/SubMenu/SubMenu';
import { cleanUpDashboardAndVariables } from '../state/actions';
import { cancelVariables, templateVarsChangedInUrl } from '../../variables/state/actions';
import { findTemplateVarChanges } from '../../variables/utils';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getTimeSrv } from '../services/TimeSrv';
import { getKioskMode } from 'app/core/navigation/kiosk';
import { UrlQueryValue } from '@grafana/data';

export interface DashboardPageRouteParams {
  uid?: string;
  type?: string;
  slug?: string;
}

type DashboardPageRouteSearchParams = {
  tab?: string;
  folderId?: string;
  editPanel?: string;
  viewPanel?: string;
  editview?: string;
  inspect?: string;
  kiosk?: UrlQueryValue;
  from?: string;
  to?: string;
  refresh?: string;
};

export interface Props extends GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams> {
  initPhase: DashboardInitPhase;
  isInitSlow: boolean;
  dashboard: DashboardModel | null;
  initError?: DashboardInitError;
  initDashboard: typeof initDashboard;
  cleanUpDashboardAndVariables: typeof cleanUpDashboardAndVariables;
  notifyApp: typeof notifyApp;
  isPanelEditorOpen?: boolean;
  cancelVariables: typeof cancelVariables;
  templateVarsChangedInUrl: typeof templateVarsChangedInUrl;
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
  private forceRouteReloadCounter = 0;
  state: State = this.getCleanState();

  getCleanState(): State {
    return {
      editPanel: null,
      viewPanel: null,
      showLoadingState: false,
      scrollTop: 0,
      rememberScrollTop: 0,
    };
  }

  componentDidMount() {
    this.initDashboard();
    this.forceRouteReloadCounter = (this.props.history.location.state as any)?.routeReloadCounter || 0;
  }

  componentWillUnmount() {
    this.closeDashboard();
  }

  closeDashboard() {
    this.props.cleanUpDashboardAndVariables();
    this.setPanelFullscreenClass(false);
    this.setState(this.getCleanState());
  }

  initDashboard() {
    const { dashboard, match, queryParams } = this.props;

    if (dashboard) {
      this.closeDashboard();
    }

    this.props.initDashboard({
      $injector: getLegacyAngularInjector(),
      urlSlug: match.params.slug,
      urlUid: match.params.uid,
      urlType: match.params.type,
      urlFolderId: queryParams.folderId,
      routeName: this.props.route.routeName,
      fixUrl: true,
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { dashboard, match, queryParams, templateVarsChangedInUrl } = this.props;
    const { editPanel, viewPanel } = this.state;

    const routeReloadCounter = (this.props.history.location.state as any)?.routeReloadCounter;

    if (!dashboard) {
      return;
    }

    // if we just got dashboard update title
    if (prevProps.dashboard !== dashboard) {
      document.title = dashboard.title + ' - ' + Branding.AppTitle;
    }

    if (
      prevProps.match.params.uid !== match.params.uid ||
      (routeReloadCounter !== undefined && this.forceRouteReloadCounter !== routeReloadCounter)
    ) {
      this.initDashboard();
      this.forceRouteReloadCounter = routeReloadCounter;
      return;
    }

    if (prevProps.location.search !== this.props.location.search) {
      const prevUrlParams = prevProps.queryParams;
      const urlParams = this.props.queryParams;

      if (urlParams?.from !== prevUrlParams?.from && urlParams?.to !== prevUrlParams?.to) {
        getTimeSrv().updateTimeRangeFromUrl();
      }

      if (!prevUrlParams?.refresh && urlParams?.refresh) {
        getTimeSrv().setAutoRefresh(urlParams.refresh);
      }

      const templateVarChanges = findTemplateVarChanges(this.props.queryParams, prevProps.queryParams);

      if (templateVarChanges) {
        templateVarsChangedInUrl(templateVarChanges);
      }
    }

    const urlEditPanelId = queryParams.editPanel;
    const urlViewPanelId = queryParams.viewPanel;

    // entering edit mode
    if (!editPanel && urlEditPanelId) {
      dashboardWatcher.setEditingState(true);

      this.getPanelByIdFromUrlParam(urlEditPanelId, (panel) => {
        // if no edit permission show error
        if (!dashboard.canEditPanel(panel)) {
          this.props.notifyApp(createErrorNotification('Permission to edit panel denied'));
          return;
        }

        this.setState({ editPanel: panel });
      });
    }

    // leaving edit mode
    if (editPanel && !urlEditPanelId) {
      dashboardWatcher.setEditingState(false);
      this.setState({ editPanel: null });
    }

    // entering view mode
    if (!viewPanel && urlViewPanelId) {
      this.getPanelByIdFromUrlParam(urlViewPanelId, (panel) => {
        this.setPanelFullscreenClass(true);
        dashboard.initViewPanel(panel);
        this.setState({
          viewPanel: panel,
          rememberScrollTop: this.state.scrollTop,
          updateScrollTop: 0,
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
      this.props.notifyApp(createErrorNotification(`Panel with ID ${urlPanelId} not found`));
      // Clear url state
      locationService.partial({ editPanel: null, viewPanel: null });
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
    this.setState({ scrollTop: target.scrollTop, updateScrollTop: undefined });
  };

  onAddPanel = () => {
    const { dashboard } = this.props;

    if (!dashboard) {
      return;
    }

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

  cancelVariables = () => {
    locationService.push('/');
  };

  renderSlowInitState() {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__text">
          <VerticalGroup spacing="md">
            <HorizontalGroup align="center" justify="center" spacing="xs">
              <Spinner inline={true} /> {this.props.initPhase}
            </HorizontalGroup>{' '}
            <HorizontalGroup align="center" justify="center">
              <Button variant="secondary" size="md" icon="repeat" onClick={this.cancelVariables}>
                Cancel loading dashboard
              </Button>
            </HorizontalGroup>
          </VerticalGroup>
        </div>
      </div>
    );
  }

  renderInitFailedState() {
    const { initError } = this.props;

    if (!initError) {
      return null;
    }

    return (
      <div className="dashboard-loading">
        <Alert severity={AppNotificationSeverity.Error} title={initError.message}>
          {getMessageFromError(initError.error)}
        </Alert>
      </div>
    );
  }

  getInspectPanel() {
    const { dashboard, queryParams } = this.props;

    const inspectPanelId = queryParams.inspect;

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
    const { dashboard, isInitSlow, initError, isPanelEditorOpen, queryParams } = this.props;
    const { editPanel, viewPanel, scrollTop, updateScrollTop } = this.state;

    if (!dashboard) {
      if (isInitSlow) {
        return this.renderSlowInitState();
      }

      return null;
    }

    // Only trigger render when the scroll has moved by 25
    const approximateScrollTop = Math.round(scrollTop / 25) * 25;
    const inspectPanel = this.getInspectPanel();
    const kioskMode = getKioskMode(queryParams.kiosk);

    return (
      <div className="dashboard-container">
        {kioskMode !== KioskMode.Full && (
          <div aria-label={selectors.pages.Dashboard.DashNav.nav}>
            <DashNav
              dashboard={dashboard}
              isFullscreen={!!viewPanel}
              onAddPanel={this.onAddPanel}
              kioskMode={kioskMode}
              hideTimePicker={dashboard.timepicker.hidden}
            />
          </div>
        )}

        <div className="dashboard-scroll">
          <CustomScrollbar
            autoHeightMin="100%"
            setScrollTop={this.setScrollTop}
            scrollTop={updateScrollTop}
            hideHorizontalTrack={true}
            updateAfterMountMs={500}
          >
            <div className="dashboard-content">
              {initError && this.renderInitFailedState()}
              {!editPanel && kioskMode === KioskMode.Off && (
                <div aria-label={selectors.pages.Dashboard.SubMenu.submenu}>
                  <SubMenu dashboard={dashboard} annotations={dashboard.annotations.list} links={dashboard.links} />
                </div>
              )}

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

        {inspectPanel && <PanelInspector dashboard={dashboard} panel={inspectPanel} />}
        {editPanel && <PanelEditor dashboard={dashboard} sourcePanel={editPanel} tab={this.props.queryParams.tab} />}
        {queryParams.editview && <DashboardSettings dashboard={dashboard} editview={queryParams.editview} />}
      </div>
    );
  }
}

export const mapStateToProps = (state: StoreState) => ({
  initPhase: state.dashboard.initPhase,
  isInitSlow: state.dashboard.isInitSlow,
  initError: state.dashboard.initError,
  dashboard: state.dashboard.getModel(),
  isPanelEditorOpen: state.panelEditor.isOpen,
});

const mapDispatchToProps = {
  initDashboard,
  cleanUpDashboardAndVariables,
  notifyApp,
  cancelVariables,
  templateVarsChangedInUrl,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardPage));
