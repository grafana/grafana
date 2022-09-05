import classnames from 'classnames';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { locationUtil, NavModelItem, TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Themeable2, withTheme2 } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { Page } from 'app/core/components/Page/Page';
import { PageLayoutType } from 'app/core/components/Page/types';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getKioskMode } from 'app/core/navigation/kiosk';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { getPageNavFromSlug, getRootContentNavModel } from 'app/features/storage/StorageFolderPage';
import { DashboardRoutes, KioskMode, StoreState } from 'app/types';
import { PanelEditEnteredEvent, PanelEditExitedEvent } from 'app/types/events';

import { cancelVariables, templateVarsChangedInUrl } from '../../variables/state/actions';
import { findTemplateVarChanges } from '../../variables/utils';
import { DashNav } from '../components/DashNav';
import { DashboardFailed } from '../components/DashboardLoading/DashboardFailed';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { DashboardPrompt } from '../components/DashboardPrompt/DashboardPrompt';
import { DashboardSettings } from '../components/DashboardSettings';
import { PanelInspector } from '../components/Inspector/PanelInspector';
import { PanelEditor } from '../components/PanelEditor/PanelEditor';
import { SubMenu } from '../components/SubMenu/SubMenu';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { liveTimer } from '../dashgrid/liveTimer';
import { getTimeSrv } from '../services/TimeSrv';
import { cleanUpDashboardAndVariables } from '../state/actions';
import { initDashboard } from '../state/initDashboard';

export interface DashboardPageRouteParams {
  uid?: string;
  type?: string;
  slug?: string;
  accessToken?: string;
}

export type DashboardPageRouteSearchParams = {
  tab?: string;
  folderId?: string;
  editPanel?: string;
  viewPanel?: string;
  editview?: string;
  panelType?: string;
  inspect?: string;
  from?: string;
  to?: string;
  refresh?: string;
};

export const mapStateToProps = (state: StoreState) => ({
  initPhase: state.dashboard.initPhase,
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

const connector = connect(mapStateToProps, mapDispatchToProps);

type OwnProps = {
  isPublic?: boolean;
};

export type Props = OwnProps &
  Themeable2 &
  GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams> &
  ConnectedProps<typeof connector>;

export interface State {
  editPanel: PanelModel | null;
  viewPanel: PanelModel | null;
  updateScrollTop?: number;
  rememberScrollTop: number;
  showLoadingState: boolean;
  panelNotFound: boolean;
  editPanelAccessDenied: boolean;
  scrollElement?: HTMLDivElement;
}

export class UnthemedDashboardPage extends PureComponent<Props, State> {
  private forceRouteReloadCounter = 0;
  state: State = this.getCleanState();
  pageNav?: NavModelItem;

  getCleanState(): State {
    return {
      editPanel: null,
      viewPanel: null,
      showLoadingState: false,
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
    const { dashboard, isPublic, match, queryParams } = this.props;

    if (dashboard) {
      this.closeDashboard();
    }

    this.props.initDashboard({
      urlSlug: match.params.slug,
      urlUid: match.params.uid,
      urlType: match.params.type,
      urlFolderId: queryParams.folderId,
      panelType: queryParams.panelType,
      routeName: this.props.route.routeName,
      fixUrl: !isPublic,
      accessToken: match.params.accessToken,
    });

    // small delay to start live updates
    setTimeout(this.updateLiveTimer, 250);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { dashboard, match, templateVarsChangedInUrl } = this.props;
    const routeReloadCounter = (this.props.history.location.state as any)?.routeReloadCounter;

    if (!dashboard) {
      return;
    }

    this.updatePageNav(dashboard);

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
        this.updateLiveTimer();
      }

      if (!prevUrlParams?.refresh && urlParams?.refresh) {
        getTimeSrv().setAutoRefresh(urlParams.refresh);
      }

      const templateVarChanges = findTemplateVarChanges(this.props.queryParams, prevProps.queryParams);

      if (templateVarChanges) {
        templateVarsChangedInUrl(dashboard.uid, templateVarChanges);
      }
    }

    // entering edit mode
    if (this.state.editPanel && !prevState.editPanel) {
      dashboardWatcher.setEditingState(true);

      // Some panels need to be notified when entering edit mode
      this.props.dashboard?.events.publish(new PanelEditEnteredEvent(this.state.editPanel.id));
    }

    // leaving edit mode
    if (!this.state.editPanel && prevState.editPanel) {
      dashboardWatcher.setEditingState(false);

      // Some panels need kicked when leaving edit mode
      this.props.dashboard?.events.publish(new PanelEditExitedEvent(prevState.editPanel.id));
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

  updateLiveTimer = () => {
    let tr: TimeRange | undefined = undefined;
    if (this.props.dashboard?.liveNow) {
      tr = getTimeSrv().timeRange();
    }
    liveTimer.setLiveTimeRange(tr);
  };

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
        return { ...state, editPanel: panel, rememberScrollTop: state.scrollElement?.scrollTop };
      } else {
        return { ...state, editPanelAccessDenied: true };
      }
    }
    // Leaving edit mode
    else if (state.editPanel && !urlEditPanelId) {
      return { ...state, editPanel: null, updateScrollTop: state.rememberScrollTop };
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

      return { ...state, viewPanel: panel, rememberScrollTop: state.scrollElement?.scrollTop, updateScrollTop: 0 };
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

  setScrollRef = (scrollElement: HTMLDivElement): void => {
    this.setState({ scrollElement });
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

  updatePageNav(dashboard: DashboardModel) {
    if (!this.pageNav || dashboard.title !== this.pageNav.text) {
      this.pageNav = {
        text: dashboard.title,
        url: locationUtil.getUrlForPartial(this.props.history.location, {
          editview: null,
          editPanel: null,
          viewPanel: null,
        }),
      };
    }

    // Check if folder changed
    if (
      dashboard.meta.folderTitle &&
      (!this.pageNav.parentItem || this.pageNav.parentItem.text !== dashboard.meta.folderTitle)
    ) {
      this.pageNav.parentItem = {
        text: dashboard.meta.folderTitle,
        url: `/dashboards/f/${dashboard.meta.folderUid}`,
      };
    }

    if (this.props.route.routeName === DashboardRoutes.Path) {
      const pageNav = getPageNavFromSlug(this.props.match.params.slug!);
      if (pageNav?.parentItem) {
        this.pageNav.parentItem = pageNav.parentItem;
      }
    }
  }

  getPageProps() {
    if (this.props.route.routeName === DashboardRoutes.Path) {
      return { navModel: getRootContentNavModel(), pageNav: this.pageNav };
    } else {
      return { navId: 'dashboards', pageNav: this.pageNav };
    }
  }

  render() {
    const { dashboard, initError, queryParams, isPublic } = this.props;
    const { editPanel, viewPanel, updateScrollTop } = this.state;
    const kioskMode = !isPublic ? getKioskMode() : KioskMode.Full;

    if (!dashboard) {
      return <DashboardLoading initPhase={this.props.initPhase} />;
    }

    const inspectPanel = this.getInspectPanel();
    const containerClassNames = classnames({ 'panel-in-fullscreen': viewPanel });

    const showSubMenu = !editPanel && kioskMode === KioskMode.Off && !this.props.queryParams.editview;
    const toolbar = kioskMode !== KioskMode.Full && (
      <header data-testid={selectors.pages.Dashboard.DashNav.navV2}>
        <DashNav
          dashboard={dashboard}
          title={dashboard.title}
          folderTitle={dashboard.meta.folderTitle}
          isFullscreen={!!viewPanel}
          onAddPanel={this.onAddPanel}
          kioskMode={kioskMode}
          hideTimePicker={dashboard.timepicker.hidden}
        />
      </header>
    );

    return (
      <Page
        {...this.getPageProps()}
        layout={PageLayoutType.Dashboard}
        toolbar={toolbar}
        className={containerClassNames}
        scrollRef={this.setScrollRef}
        scrollTop={updateScrollTop}
      >
        <DashboardPrompt dashboard={dashboard} />

        {initError && <DashboardFailed />}
        {showSubMenu && (
          <section aria-label={selectors.pages.Dashboard.SubMenu.submenu}>
            <SubMenu dashboard={dashboard} annotations={dashboard.annotations.list} links={dashboard.links} />
          </section>
        )}

        <DashboardGrid dashboard={dashboard} viewPanel={viewPanel} editPanel={editPanel} />

        {inspectPanel && <PanelInspector dashboard={dashboard} panel={inspectPanel} />}
        {editPanel && <PanelEditor dashboard={dashboard} sourcePanel={editPanel} tab={this.props.queryParams.tab} />}
        {queryParams.editview && <DashboardSettings dashboard={dashboard} editview={queryParams.editview} />}
      </Page>
    );
  }
}

export const DashboardPage = withTheme2(UnthemedDashboardPage);
DashboardPage.displayName = 'DashboardPage';
export default connector(DashboardPage);
