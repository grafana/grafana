import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { locationService } from '@grafana/runtime';
import { selectors } from '@grafana/e2e-selectors';
import { CustomScrollbar, ScrollbarPosition, stylesFactory, Themeable2, withTheme2 } from '@grafana/ui';

import { createErrorNotification } from 'app/core/copy/appNotification';
import { Branding } from 'app/core/components/Branding/Branding';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { DashNav } from '../components/DashNav';
import { DashboardSettings } from '../components/DashboardSettings';
import { PanelEditor } from '../components/PanelEditor/PanelEditor';
import { initDashboard } from '../state/initDashboard';
import { notifyApp } from 'app/core/actions';
import { DashboardInitError, DashboardInitPhase, KioskMode, StoreState } from 'app/types';
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
import { GrafanaTheme2, UrlQueryValue } from '@grafana/data';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { DashboardFailed } from '../components/DashboardLoading/DashboardFailed';
import { DashboardPrompt } from '../components/DashboardPrompt/DashboardPrompt';
import classnames from 'classnames';

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

export interface Props
  extends Themeable2,
    GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams> {
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
  panelNotFound: boolean;
  editPanelAccessDenied: boolean;
}

export class UnthemedDashboardPage extends PureComponent<Props, State> {
  private forceRouteReloadCounter = 0;
  state: State = this.getCleanState();

  getCleanState(): State {
    return {
      editPanel: null,
      viewPanel: null,
      showLoadingState: false,
      scrollTop: 0,
      rememberScrollTop: 0,
      panelNotFound: false,
      editPanelAccessDenied: false,
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
    this.setState(this.getCleanState());
  }

  initDashboard() {
    const { dashboard, match, queryParams } = this.props;

    if (dashboard) {
      this.closeDashboard();
    }

    this.props.initDashboard({
      urlSlug: match.params.slug,
      urlUid: match.params.uid,
      urlType: match.params.type,
      urlFolderId: queryParams.folderId,
      routeName: this.props.route.routeName,
      fixUrl: true,
    });
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { dashboard, match, templateVarsChangedInUrl } = this.props;
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

      if (urlParams?.from !== prevUrlParams?.from || urlParams?.to !== prevUrlParams?.to) {
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

    // entering edit mode
    if (this.state.editPanel && !prevState.editPanel) {
      dashboardWatcher.setEditingState(true);
    }

    // leaving edit mode
    if (!this.state.editPanel && prevState.editPanel) {
      dashboardWatcher.setEditingState(false);
    }

    if (this.state.editPanelAccessDenied) {
      this.props.notifyApp(createErrorNotification('Permission to edit panel denied'));
      locationService.partial({ editPanel: null });
    }

    if (this.state.panelNotFound) {
      this.props.notifyApp(createErrorNotification(`Panel not found`));
      locationService.partial({ editPanel: null, viewPanel: null });
    }
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    const { dashboard, queryParams } = props;

    const urlEditPanelId = queryParams.editPanel;
    const urlViewPanelId = queryParams.viewPanel;

    if (!dashboard) {
      return state;
    }

    // Entering edit mode
    if (!state.editPanel && urlEditPanelId) {
      const panel = dashboard.getPanelByUrlId(urlEditPanelId);
      if (!panel) {
        return { ...state, panelNotFound: true };
      }

      if (dashboard.canEditPanel(panel)) {
        return { ...state, editPanel: panel };
      } else {
        return { ...state, editPanelAccessDenied: true };
      }
    }
    // Leaving edit mode
    else if (state.editPanel && !urlEditPanelId) {
      return { ...state, editPanel: null };
    }

    // Entering view mode
    if (!state.viewPanel && urlViewPanelId) {
      const panel = dashboard.getPanelByUrlId(urlViewPanelId);
      if (!panel) {
        return { ...state, panelNotFound: urlEditPanelId };
      }

      // This mutable state feels wrong to have in getDerivedStateFromProps
      // Should move this state out of dashboard in the future
      dashboard.initViewPanel(panel);

      return {
        ...state,
        viewPanel: panel,
        rememberScrollTop: state.scrollTop,
        updateScrollTop: 0,
      };
    }
    // Leaving view mode
    else if (state.viewPanel && !urlViewPanelId) {
      // This mutable state feels wrong to have in getDerivedStateFromProps
      // Should move this state out of dashboard in the future
      dashboard.exitViewPanel(state.viewPanel);

      return { ...state, viewPanel: null, updateScrollTop: state.rememberScrollTop };
    }

    // if we removed url edit state, clear any panel not found state
    if (state.panelNotFound || (state.editPanelAccessDenied && !urlEditPanelId)) {
      return { ...state, panelNotFound: false, editPanelAccessDenied: false };
    }

    return state;
  }

  setScrollTop = ({ scrollTop }: ScrollbarPosition): void => {
    this.setState({ scrollTop, updateScrollTop: undefined });
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
    const { dashboard, isInitSlow, initError, queryParams, theme } = this.props;
    const { editPanel, viewPanel, scrollTop, updateScrollTop } = this.state;
    const kioskMode = getKioskMode(queryParams.kiosk);
    const styles = getStyles(theme, kioskMode);

    if (!dashboard) {
      if (isInitSlow) {
        return <DashboardLoading initPhase={this.props.initPhase} />;
      }

      return null;
    }

    // Only trigger render when the scroll has moved by 25
    const approximateScrollTop = Math.round(scrollTop / 25) * 25;
    const inspectPanel = this.getInspectPanel();
    const containerClassNames = classnames(styles.dashboardContainer, {
      'panel-in-fullscreen': viewPanel,
    });

    return (
      <div className={containerClassNames}>
        {kioskMode !== KioskMode.Full && (
          <div aria-label={selectors.pages.Dashboard.DashNav.nav}>
            <DashNav
              dashboard={dashboard}
              title={dashboard.title}
              folderTitle={dashboard.meta.folderTitle}
              isFullscreen={!!viewPanel}
              onAddPanel={this.onAddPanel}
              kioskMode={kioskMode}
              hideTimePicker={dashboard.timepicker.hidden}
            />
          </div>
        )}

        <DashboardPrompt dashboard={dashboard} />

        <div className={styles.dashboardScroll}>
          <CustomScrollbar
            autoHeightMin="100%"
            setScrollTop={this.setScrollTop}
            scrollTop={updateScrollTop}
            hideHorizontalTrack={true}
            updateAfterMountMs={500}
          >
            <div className={styles.dashboardContent}>
              {initError && <DashboardFailed />}
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
});

const mapDispatchToProps = {
  initDashboard,
  cleanUpDashboardAndVariables,
  notifyApp,
  cancelVariables,
  templateVarsChangedInUrl,
};

/*
 * Styles
 */
export const getStyles = stylesFactory((theme: GrafanaTheme2, kioskMode) => {
  const contentPadding = kioskMode !== KioskMode.Full ? theme.spacing(0, 2, 2) : theme.spacing(2);
  return {
    dashboardContainer: css`
      position: absolute;
      top: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
    `,
    dashboardScroll: css`
      width: 100%;
      flex-grow: 1;
      min-height: 0;
      display: flex;
    `,
    dashboardContent: css`
      padding: ${contentPadding};
      flex-basis: 100%;
      flex-grow: 1;
    `,
  };
});

export const DashboardPage = withTheme2(UnthemedDashboardPage);
DashboardPage.displayName = 'DashboardPage';
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardPage));
