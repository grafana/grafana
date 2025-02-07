import { css, cx } from '@emotion/css';
import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { NavModel, NavModelItem, TimeRange, PageLayoutType, locationUtil, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Themeable2, withTheme2 } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { ScrollRefElement } from 'app/core/components/NativeScrollbar';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaContext, GrafanaContextType } from 'app/core/context/GrafanaContext';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getKioskMode } from 'app/core/navigation/kiosk';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { ID_PREFIX } from 'app/core/reducers/navBarTree';
import { getNavModel } from 'app/core/selectors/navModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { KioskMode, StoreState } from 'app/types';
import { PanelEditEnteredEvent, PanelEditExitedEvent } from 'app/types/events';

import { cancelVariables, templateVarsChangedInUrl } from '../../variables/state/actions';
import { findTemplateVarChanges } from '../../variables/utils';
import { DashNav } from '../components/DashNav';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { DashboardPrompt } from '../components/DashboardPrompt/DashboardPrompt';
import { DashboardSettings } from '../components/DashboardSettings';
import { PanelInspector } from '../components/Inspector/PanelInspector';
import { PanelEditor } from '../components/PanelEditor/PanelEditor';
import { ShareModal } from '../components/ShareModal/ShareModal';
import { SubMenu } from '../components/SubMenu/SubMenu';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { liveTimer } from '../dashgrid/liveTimer';
import { getTimeSrv } from '../services/TimeSrv';
import { cleanUpDashboardAndVariables } from '../state/actions';
import { initDashboard } from '../state/initDashboard';

import { DashboardPageError } from './DashboardPageError';
import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from './types';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

export const mapStateToProps = (state: StoreState) => ({
  initPhase: state.dashboard.initPhase,
  initError: state.dashboard.initError,
  dashboard: state.dashboard.getModel(),
  navIndex: state.navIndex,
});

const mapDispatchToProps = {
  initDashboard,
  cleanUpDashboardAndVariables,
  notifyApp,
  cancelVariables,
  templateVarsChangedInUrl,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type DashboardPageParams = { slug: string; uid: string; type: string; accessToken: string };
export type Props = Themeable2 &
  Omit<GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>, 'match'> &
  // The params returned from useParams are all optional, so we need to match that type here
  ConnectedProps<typeof connector> & { params: Partial<DashboardPageParams> };

export interface State {
  editPanel: PanelModel | null;
  viewPanel: PanelModel | null;
  editView: string | null;
  updateScrollTop?: number;
  rememberScrollTop?: number;
  showLoadingState: boolean;
  panelNotFound: boolean;
  editPanelAccessDenied: boolean;
  scrollElement?: ScrollRefElement;
  pageNav?: NavModelItem;
  sectionNav?: NavModel;
}

const getStyles = (theme: GrafanaTheme2) => ({
  fullScreenPanel: css({
    '.react-grid-layout': {
      height: 'auto !important',
      transitionProperty: 'none',
    },
    '.react-grid-item': {
      display: 'none !important',
      transitionProperty: 'none !important',

      '&--fullscreen': {
        display: 'block !important',
        // can't avoid type assertion here due to !important
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        position: 'unset !important' as 'unset',
        transform: 'translate(0px, 0px) !important',
      },
    },

    // Disable grid interaction indicators in fullscreen panels
    '.panel-header:hover': {
      backgroundColor: 'inherit',
    },

    '.panel-title-container': {
      cursor: 'pointer',
    },

    '.react-resizable-handle': {
      display: 'none',
    },
  }),
});

export class UnthemedDashboardPage extends PureComponent<Props, State> {
  declare context: GrafanaContextType;
  static contextType = GrafanaContext;

  private forceRouteReloadCounter = 0;
  state: State = this.getCleanState();

  getCleanState(): State {
    return {
      editView: null,
      editPanel: null,
      viewPanel: null,
      showLoadingState: false,
      panelNotFound: false,
      editPanelAccessDenied: false,
    };
  }

  componentDidMount() {
    this.initDashboard();
    this.forceRouteReloadCounter = (this.props.location.state as any)?.routeReloadCounter || 0;
  }

  componentWillUnmount() {
    this.closeDashboard();
  }

  closeDashboard() {
    this.props.cleanUpDashboardAndVariables();
    this.setState(this.getCleanState());
  }

  initDashboard() {
    const { dashboard, params, queryParams } = this.props;

    if (dashboard) {
      this.closeDashboard();
    }

    this.props.initDashboard({
      urlSlug: params.slug,
      urlUid: params.uid,
      urlType: params.type,
      urlFolderUid: queryParams.folderUid,
      panelType: queryParams.panelType,
      routeName: this.props.route.routeName,
      fixUrl: true,
      accessToken: params.accessToken,
      keybindingSrv: this.context.keybindings,
    });

    // small delay to start live updates
    setTimeout(this.updateLiveTimer, 250);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { dashboard, params, templateVarsChangedInUrl } = this.props;
    const routeReloadCounter = (this.props.location.state as any)?.routeReloadCounter;

    if (!dashboard) {
      return;
    }

    if (
      prevProps.params.uid !== params.uid ||
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

    // Update window scroll position
    if (this.state.updateScrollTop !== undefined && this.state.updateScrollTop !== prevState.updateScrollTop) {
      this.state.scrollElement?.scrollTo(0, this.state.updateScrollTop);
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
    const urlEditView = queryParams.editview;

    if (!dashboard) {
      return state;
    }

    const updatedState = { ...state };

    // Entering settings view
    if (!state.editView && urlEditView) {
      updatedState.editView = urlEditView;
      updatedState.rememberScrollTop = state.scrollElement?.scrollTop;
      updatedState.updateScrollTop = 0;
    }

    // Leaving settings view
    else if (state.editView && !urlEditView) {
      updatedState.updateScrollTop = state.rememberScrollTop;
      updatedState.editView = null;
    }

    // Entering edit mode
    if (!state.editPanel && urlEditPanelId) {
      const panel = dashboard.getPanelByUrlId(urlEditPanelId);
      if (panel) {
        if (dashboard.canEditPanel(panel)) {
          updatedState.editPanel = panel;
          updatedState.rememberScrollTop = state.scrollElement?.scrollTop;
        } else {
          updatedState.editPanelAccessDenied = true;
        }
      } else {
        updatedState.panelNotFound = true;
      }
    }
    // Leaving edit mode
    else if (state.editPanel && !urlEditPanelId) {
      updatedState.editPanel = null;
      updatedState.updateScrollTop = state.rememberScrollTop;
    }

    // Entering view mode
    if (!state.viewPanel && urlViewPanelId) {
      const panel = dashboard.getPanelByUrlId(urlViewPanelId);
      if (panel) {
        // This mutable state feels wrong to have in getDerivedStateFromProps
        // Should move this state out of dashboard in the future
        dashboard.initViewPanel(panel);
        updatedState.viewPanel = panel;
        updatedState.rememberScrollTop = state.scrollElement?.scrollTop;
        updatedState.updateScrollTop = 0;
      } else {
        updatedState.panelNotFound = true;
      }
    }
    // Leaving view mode
    else if (state.viewPanel && !urlViewPanelId) {
      // This mutable state feels wrong to have in getDerivedStateFromProps
      // Should move this state out of dashboard in the future
      dashboard.exitViewPanel(state.viewPanel);
      updatedState.viewPanel = null;
      updatedState.updateScrollTop = state.rememberScrollTop;
    }

    // if we removed url edit state, clear any panel not found state
    if (state.panelNotFound || (state.editPanelAccessDenied && !urlEditPanelId)) {
      updatedState.panelNotFound = false;
      updatedState.editPanelAccessDenied = false;
    }

    return updateStatePageNavFromProps(props, updatedState);
  }

  setScrollRef = (scrollElement: ScrollRefElement): void => {
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

  onCloseShareModal = () => {
    locationService.partial({ shareView: null });
  };

  render() {
    const { dashboard, initError, queryParams, theme, params } = this.props;

    const { editPanel, viewPanel, pageNav, sectionNav } = this.state;
    const kioskMode = getKioskMode(this.props.queryParams);
    const styles = getStyles(theme);

    if (!dashboard || !pageNav || !sectionNav) {
      return <DashboardLoading initPhase={this.props.initPhase} />;
    }

    const inspectPanel = this.getInspectPanel();
    const showSubMenu = !editPanel && !kioskMode && !this.props.queryParams.editview && dashboard.isSubMenuVisible();

    const showToolbar = kioskMode !== KioskMode.Full && !queryParams.editview && !initError;

    const pageClassName = cx({
      [styles.fullScreenPanel]: Boolean(viewPanel),
      'page-hidden': Boolean(queryParams.editview || editPanel),
    });

    return (
      <>
        <Page
          navModel={sectionNav}
          pageNav={pageNav}
          layout={PageLayoutType.Canvas}
          className={pageClassName}
          onSetScrollRef={this.setScrollRef}
        >
          {showToolbar && (
            <header data-testid={selectors.pages.Dashboard.DashNav.navV2}>
              <DashNav
                dashboard={dashboard}
                title={dashboard.title}
                folderTitle={dashboard.meta.folderTitle}
                isFullscreen={!!viewPanel}
                kioskMode={kioskMode}
                hideTimePicker={dashboard.timepicker.hidden}
              />
            </header>
          )}
          <DashboardPrompt dashboard={dashboard} />
          {initError && <DashboardPageError error={initError.error} type={params.type} />}
          {showSubMenu && (
            <section aria-label={selectors.pages.Dashboard.SubMenu.submenu}>
              <SubMenu dashboard={dashboard} annotations={dashboard.annotations.list} links={dashboard.links} />
            </section>
          )}
          {!initError && (
            <DashboardGrid
              dashboard={dashboard}
              isEditable={!!dashboard.meta.canEdit}
              viewPanel={viewPanel}
              editPanel={editPanel}
            />
          )}

          {inspectPanel && <PanelInspector dashboard={dashboard} panel={inspectPanel} />}
          {queryParams.shareView && (
            <ShareModal dashboard={dashboard} onDismiss={this.onCloseShareModal} activeTab={queryParams.shareView} />
          )}
        </Page>
        {editPanel && (
          <PanelEditor
            dashboard={dashboard}
            sourcePanel={editPanel}
            tab={this.props.queryParams.tab}
            sectionNav={sectionNav}
            pageNav={pageNav}
          />
        )}
        {queryParams.editview && (
          <DashboardSettings
            dashboard={dashboard}
            editview={queryParams.editview}
            pageNav={pageNav}
            sectionNav={sectionNav}
          />
        )}
      </>
    );
  }
}

function updateStatePageNavFromProps(props: Props, state: State): State {
  const { dashboard, navIndex } = props;

  if (!dashboard) {
    return state;
  }

  let pageNav = state.pageNav;
  let sectionNav = state.sectionNav;

  if (!pageNav || dashboard.title !== pageNav.text || dashboard.meta.folderUrl !== pageNav.parentItem?.url) {
    pageNav = {
      text: dashboard.title,
      url: locationUtil.getUrlForPartial(props.location, {
        editview: null,
        editPanel: null,
        viewPanel: null,
      }),
    };
  }

  sectionNav = getNavModel(props.navIndex, ID_PREFIX + dashboard.uid, getNavModel(props.navIndex, 'dashboards/browse'));

  const { folderUid } = dashboard.meta;
  if (folderUid && pageNav && sectionNav.main.id !== 'starred') {
    const folderNavModel = getNavModel(navIndex, `folder-dashboards-${folderUid}`).main;
    // If the folder hasn't loaded (maybe user doesn't have permission on it?) then
    // don't show the "page not found" breadcrumb
    if (folderNavModel.id !== 'not-found') {
      pageNav = {
        ...pageNav,
        parentItem: folderNavModel,
      };
    }
  }

  if (state.editPanel || state.viewPanel) {
    pageNav = {
      ...pageNav,
      text: `${state.editPanel ? 'Edit' : 'View'} panel`,
      parentItem: pageNav,
      url: undefined,
    };
  }

  if (state.pageNav === pageNav && state.sectionNav === sectionNav) {
    return state;
  }

  return {
    ...state,
    pageNav,
    sectionNav,
  };
}

export const DashboardPage = withTheme2(UnthemedDashboardPage);
DashboardPage.displayName = 'DashboardPage';
export default connector(DashboardPage);
