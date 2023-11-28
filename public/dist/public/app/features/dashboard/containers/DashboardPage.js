import { cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { PageLayoutType, locationUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import { withTheme2 } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getKioskMode } from 'app/core/navigation/kiosk';
import { getNavModel } from 'app/core/selectors/navModel';
import { newBrowseDashboardsEnabled } from 'app/features/browse-dashboards/featureFlag';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { AngularDeprecationNotice } from 'app/features/plugins/angularDeprecation/AngularDeprecationNotice';
import { getPageNavFromSlug, getRootContentNavModel } from 'app/features/storage/StorageFolderPage';
import { DashboardRoutes, KioskMode } from 'app/types';
import { PanelEditEnteredEvent, PanelEditExitedEvent } from 'app/types/events';
import { cancelVariables, templateVarsChangedInUrl } from '../../variables/state/actions';
import { findTemplateVarChanges } from '../../variables/utils';
import { AddWidgetModal } from '../components/AddWidgetModal/AddWidgetModal';
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
import { calculateNewPanelGridPos } from '../utils/panel';
export const mapStateToProps = (state) => ({
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
export class UnthemedDashboardPage extends PureComponent {
    constructor() {
        super(...arguments);
        this.forceRouteReloadCounter = 0;
        this.state = this.getCleanState();
        this.updateLiveTimer = () => {
            var _a;
            let tr = undefined;
            if ((_a = this.props.dashboard) === null || _a === void 0 ? void 0 : _a.liveNow) {
                tr = getTimeSrv().timeRange();
            }
            liveTimer.setLiveTimeRange(tr);
        };
        // Todo: Remove this when we remove the emptyDashboardPage toggle
        this.onAddPanel = () => {
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
                gridPos: calculateNewPanelGridPos(dashboard),
                title: 'Panel Title',
            });
            // scroll to top after adding panel
            this.setState({ updateScrollTop: 0 });
        };
        this.setScrollRef = (scrollElement) => {
            this.setState({ scrollElement });
        };
    }
    getCleanState() {
        return {
            editPanel: null,
            viewPanel: null,
            showLoadingState: false,
            panelNotFound: false,
            editPanelAccessDenied: false,
        };
    }
    componentDidMount() {
        var _a;
        this.initDashboard();
        this.forceRouteReloadCounter = ((_a = this.props.history.location.state) === null || _a === void 0 ? void 0 : _a.routeReloadCounter) || 0;
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
            urlFolderUid: queryParams.folderUid,
            panelType: queryParams.panelType,
            routeName: this.props.route.routeName,
            fixUrl: true,
            accessToken: match.params.accessToken,
            keybindingSrv: this.context.keybindings,
        });
        // small delay to start live updates
        setTimeout(this.updateLiveTimer, 250);
    }
    componentDidUpdate(prevProps, prevState) {
        var _a, _b, _c;
        const { dashboard, match, templateVarsChangedInUrl } = this.props;
        const routeReloadCounter = (_a = this.props.history.location.state) === null || _a === void 0 ? void 0 : _a.routeReloadCounter;
        if (!dashboard) {
            return;
        }
        if (prevProps.match.params.uid !== match.params.uid ||
            (routeReloadCounter !== undefined && this.forceRouteReloadCounter !== routeReloadCounter)) {
            this.initDashboard();
            this.forceRouteReloadCounter = routeReloadCounter;
            return;
        }
        if (prevProps.location.search !== this.props.location.search) {
            const prevUrlParams = prevProps.queryParams;
            const urlParams = this.props.queryParams;
            if ((urlParams === null || urlParams === void 0 ? void 0 : urlParams.from) !== (prevUrlParams === null || prevUrlParams === void 0 ? void 0 : prevUrlParams.from) || (urlParams === null || urlParams === void 0 ? void 0 : urlParams.to) !== (prevUrlParams === null || prevUrlParams === void 0 ? void 0 : prevUrlParams.to)) {
                getTimeSrv().updateTimeRangeFromUrl();
                this.updateLiveTimer();
            }
            if (!(prevUrlParams === null || prevUrlParams === void 0 ? void 0 : prevUrlParams.refresh) && (urlParams === null || urlParams === void 0 ? void 0 : urlParams.refresh)) {
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
            (_b = this.props.dashboard) === null || _b === void 0 ? void 0 : _b.events.publish(new PanelEditEnteredEvent(this.state.editPanel.id));
        }
        // leaving edit mode
        if (!this.state.editPanel && prevState.editPanel) {
            dashboardWatcher.setEditingState(false);
            // Some panels need kicked when leaving edit mode
            (_c = this.props.dashboard) === null || _c === void 0 ? void 0 : _c.events.publish(new PanelEditExitedEvent(prevState.editPanel.id));
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
    static getDerivedStateFromProps(props, state) {
        var _a, _b;
        const { dashboard, queryParams } = props;
        const urlEditPanelId = queryParams.editPanel;
        const urlViewPanelId = queryParams.viewPanel;
        if (!dashboard) {
            return state;
        }
        const updatedState = Object.assign({}, state);
        // Entering edit mode
        if (!state.editPanel && urlEditPanelId) {
            const panel = dashboard.getPanelByUrlId(urlEditPanelId);
            if (panel) {
                if (dashboard.canEditPanel(panel)) {
                    updatedState.editPanel = panel;
                    updatedState.rememberScrollTop = (_a = state.scrollElement) === null || _a === void 0 ? void 0 : _a.scrollTop;
                }
                else {
                    updatedState.editPanelAccessDenied = true;
                }
            }
            else {
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
                updatedState.rememberScrollTop = (_b = state.scrollElement) === null || _b === void 0 ? void 0 : _b.scrollTop;
                updatedState.updateScrollTop = 0;
            }
            else {
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
        const { dashboard, initError, queryParams } = this.props;
        const { editPanel, viewPanel, updateScrollTop, pageNav, sectionNav } = this.state;
        const kioskMode = getKioskMode(this.props.queryParams);
        if (!dashboard || !pageNav || !sectionNav) {
            return React.createElement(DashboardLoading, { initPhase: this.props.initPhase });
        }
        const inspectPanel = this.getInspectPanel();
        const showSubMenu = !editPanel && !kioskMode && !this.props.queryParams.editview;
        const showToolbar = kioskMode !== KioskMode.Full && !queryParams.editview;
        const pageClassName = cx({
            'panel-in-fullscreen': Boolean(viewPanel),
            'page-hidden': Boolean(queryParams.editview || editPanel),
        });
        if (dashboard.meta.dashboardNotFound) {
            return (React.createElement(Page, { navId: "dashboards/browse", layout: PageLayoutType.Canvas, pageNav: { text: 'Not found' } },
                React.createElement(EntityNotFound, { entity: "Dashboard" })));
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(Page, { navModel: sectionNav, pageNav: pageNav, layout: PageLayoutType.Canvas, className: pageClassName, scrollRef: this.setScrollRef, scrollTop: updateScrollTop },
                showToolbar && (React.createElement("header", { "data-testid": selectors.pages.Dashboard.DashNav.navV2 },
                    React.createElement(DashNav, { dashboard: dashboard, title: dashboard.title, folderTitle: dashboard.meta.folderTitle, isFullscreen: !!viewPanel, onAddPanel: this.onAddPanel, kioskMode: kioskMode, hideTimePicker: dashboard.timepicker.hidden }))),
                React.createElement(DashboardPrompt, { dashboard: dashboard }),
                initError && React.createElement(DashboardFailed, null),
                showSubMenu && (React.createElement("section", { "aria-label": selectors.pages.Dashboard.SubMenu.submenu },
                    React.createElement(SubMenu, { dashboard: dashboard, annotations: dashboard.annotations.list, links: dashboard.links }))),
                config.featureToggles.angularDeprecationUI && dashboard.hasAngularPlugins() && dashboard.uid !== null && (React.createElement(AngularDeprecationNotice, { dashboardUid: dashboard.uid })),
                React.createElement(DashboardGrid, { dashboard: dashboard, isEditable: !!dashboard.meta.canEdit, viewPanel: viewPanel, editPanel: editPanel }),
                inspectPanel && React.createElement(PanelInspector, { dashboard: dashboard, panel: inspectPanel })),
            editPanel && (React.createElement(PanelEditor, { dashboard: dashboard, sourcePanel: editPanel, tab: this.props.queryParams.tab, sectionNav: sectionNav, pageNav: pageNav })),
            queryParams.editview && (React.createElement(DashboardSettings, { dashboard: dashboard, editview: queryParams.editview, pageNav: pageNav, sectionNav: sectionNav })),
            queryParams.addWidget && config.featureToggles.vizAndWidgetSplit && React.createElement(AddWidgetModal, null)));
    }
}
UnthemedDashboardPage.contextType = GrafanaContext;
function updateStatePageNavFromProps(props, state) {
    var _a, _b;
    const { dashboard, navIndex } = props;
    if (!dashboard) {
        return state;
    }
    let pageNav = state.pageNav;
    let sectionNav = state.sectionNav;
    if (!pageNav || dashboard.title !== pageNav.text || dashboard.meta.folderUrl !== ((_a = pageNav.parentItem) === null || _a === void 0 ? void 0 : _a.url)) {
        pageNav = {
            text: dashboard.title,
            url: locationUtil.getUrlForPartial(props.history.location, {
                editview: null,
                editPanel: null,
                viewPanel: null,
            }),
        };
    }
    const { folderTitle, folderUid } = dashboard.meta;
    if (folderUid && pageNav) {
        if (newBrowseDashboardsEnabled()) {
            const folderNavModel = getNavModel(navIndex, `folder-dashboards-${folderUid}`).main;
            // If the folder hasn't loaded (maybe user doesn't have permission on it?) then
            // don't show the "page not found" breadcrumb
            if (folderNavModel.id !== 'not-found') {
                pageNav = Object.assign(Object.assign({}, pageNav), { parentItem: folderNavModel });
            }
        }
        else {
            // Check if folder changed
            if (folderTitle && ((_b = pageNav.parentItem) === null || _b === void 0 ? void 0 : _b.text) !== folderTitle) {
                pageNav = Object.assign(Object.assign({}, pageNav), { parentItem: {
                        text: folderTitle,
                        url: `/dashboards/f/${dashboard.meta.folderUid}`,
                    } });
            }
        }
    }
    if (props.route.routeName === DashboardRoutes.Path) {
        sectionNav = getRootContentNavModel();
        const pageNav = getPageNavFromSlug(props.match.params.slug);
        if (pageNav === null || pageNav === void 0 ? void 0 : pageNav.parentItem) {
            pageNav.parentItem = pageNav.parentItem;
        }
    }
    else {
        sectionNav = getNavModel(props.navIndex, 'dashboards/browse');
    }
    if (state.editPanel || state.viewPanel) {
        pageNav = Object.assign(Object.assign({}, pageNav), { text: `${state.editPanel ? 'Edit' : 'View'} panel`, parentItem: pageNav, url: undefined });
    }
    if (state.pageNav === pageNav && state.sectionNav === sectionNav) {
        return state;
    }
    return Object.assign(Object.assign({}, state), { pageNav,
        sectionNav });
}
export const DashboardPage = withTheme2(UnthemedDashboardPage);
DashboardPage.displayName = 'DashboardPage';
export default connector(DashboardPage);
//# sourceMappingURL=DashboardPage.js.map