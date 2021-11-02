import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { connect } from 'react-redux';
import { locationService } from '@grafana/runtime';
import { selectors } from '@grafana/e2e-selectors';
import { CustomScrollbar, stylesFactory, withTheme2 } from '@grafana/ui';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { Branding } from 'app/core/components/Branding/Branding';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { DashNav } from '../components/DashNav';
import { DashboardSettings } from '../components/DashboardSettings';
import { PanelEditor } from '../components/PanelEditor/PanelEditor';
import { initDashboard } from '../state/initDashboard';
import { notifyApp } from 'app/core/actions';
import { KioskMode } from 'app/types';
import { PanelInspector } from '../components/Inspector/PanelInspector';
import { SubMenu } from '../components/SubMenu/SubMenu';
import { cleanUpDashboardAndVariables } from '../state/actions';
import { cancelVariables, templateVarsChangedInUrl } from '../../variables/state/actions';
import { findTemplateVarChanges } from '../../variables/utils';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { getTimeSrv } from '../services/TimeSrv';
import { getKioskMode } from 'app/core/navigation/kiosk';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { DashboardFailed } from '../components/DashboardLoading/DashboardFailed';
import { DashboardPrompt } from '../components/DashboardPrompt/DashboardPrompt';
import classnames from 'classnames';
import { PanelEditEnteredEvent, PanelEditExitedEvent } from 'app/types/events';
import { liveTimer } from '../dashgrid/liveTimer';
export var mapStateToProps = function (state) { return ({
    initPhase: state.dashboard.initPhase,
    isInitSlow: state.dashboard.isInitSlow,
    initError: state.dashboard.initError,
    dashboard: state.dashboard.getModel(),
}); };
var mapDispatchToProps = {
    initDashboard: initDashboard,
    cleanUpDashboardAndVariables: cleanUpDashboardAndVariables,
    notifyApp: notifyApp,
    cancelVariables: cancelVariables,
    templateVarsChangedInUrl: templateVarsChangedInUrl,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var UnthemedDashboardPage = /** @class */ (function (_super) {
    __extends(UnthemedDashboardPage, _super);
    function UnthemedDashboardPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.forceRouteReloadCounter = 0;
        _this.state = _this.getCleanState();
        _this.updateLiveTimer = function () {
            var _a;
            var tr = undefined;
            if ((_a = _this.props.dashboard) === null || _a === void 0 ? void 0 : _a.liveNow) {
                tr = getTimeSrv().timeRange();
            }
            liveTimer.setLiveTimeRange(tr);
        };
        _this.setScrollTop = function (_a) {
            var scrollTop = _a.scrollTop;
            _this.setState({ scrollTop: scrollTop, updateScrollTop: undefined });
        };
        _this.onAddPanel = function () {
            var dashboard = _this.props.dashboard;
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
            _this.setState({ updateScrollTop: 0 });
        };
        return _this;
    }
    UnthemedDashboardPage.prototype.getCleanState = function () {
        return {
            editPanel: null,
            viewPanel: null,
            showLoadingState: false,
            scrollTop: 0,
            rememberScrollTop: 0,
            panelNotFound: false,
            editPanelAccessDenied: false,
        };
    };
    UnthemedDashboardPage.prototype.componentDidMount = function () {
        var _a;
        this.initDashboard();
        this.forceRouteReloadCounter = ((_a = this.props.history.location.state) === null || _a === void 0 ? void 0 : _a.routeReloadCounter) || 0;
    };
    UnthemedDashboardPage.prototype.componentWillUnmount = function () {
        this.closeDashboard();
    };
    UnthemedDashboardPage.prototype.closeDashboard = function () {
        this.props.cleanUpDashboardAndVariables();
        this.setState(this.getCleanState());
    };
    UnthemedDashboardPage.prototype.initDashboard = function () {
        var _a = this.props, dashboard = _a.dashboard, match = _a.match, queryParams = _a.queryParams;
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
        // small delay to start live updates
        setTimeout(this.updateLiveTimer, 250);
    };
    UnthemedDashboardPage.prototype.componentDidUpdate = function (prevProps, prevState) {
        var _a, _b, _c;
        var _d = this.props, dashboard = _d.dashboard, match = _d.match, templateVarsChangedInUrl = _d.templateVarsChangedInUrl;
        var routeReloadCounter = (_a = this.props.history.location.state) === null || _a === void 0 ? void 0 : _a.routeReloadCounter;
        if (!dashboard) {
            return;
        }
        // if we just got dashboard update title
        if (prevProps.dashboard !== dashboard) {
            document.title = dashboard.title + ' - ' + Branding.AppTitle;
        }
        if (prevProps.match.params.uid !== match.params.uid ||
            (routeReloadCounter !== undefined && this.forceRouteReloadCounter !== routeReloadCounter)) {
            this.initDashboard();
            this.forceRouteReloadCounter = routeReloadCounter;
            return;
        }
        if (prevProps.location.search !== this.props.location.search) {
            var prevUrlParams = prevProps.queryParams;
            var urlParams = this.props.queryParams;
            if ((urlParams === null || urlParams === void 0 ? void 0 : urlParams.from) !== (prevUrlParams === null || prevUrlParams === void 0 ? void 0 : prevUrlParams.from) || (urlParams === null || urlParams === void 0 ? void 0 : urlParams.to) !== (prevUrlParams === null || prevUrlParams === void 0 ? void 0 : prevUrlParams.to)) {
                getTimeSrv().updateTimeRangeFromUrl();
                this.updateLiveTimer();
            }
            if (!(prevUrlParams === null || prevUrlParams === void 0 ? void 0 : prevUrlParams.refresh) && (urlParams === null || urlParams === void 0 ? void 0 : urlParams.refresh)) {
                getTimeSrv().setAutoRefresh(urlParams.refresh);
            }
            var templateVarChanges = findTemplateVarChanges(this.props.queryParams, prevProps.queryParams);
            if (templateVarChanges) {
                templateVarsChangedInUrl(templateVarChanges);
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
            this.props.notifyApp(createErrorNotification("Panel not found"));
            locationService.partial({ editPanel: null, viewPanel: null });
        }
    };
    UnthemedDashboardPage.getDerivedStateFromProps = function (props, state) {
        var dashboard = props.dashboard, queryParams = props.queryParams;
        var urlEditPanelId = queryParams.editPanel;
        var urlViewPanelId = queryParams.viewPanel;
        if (!dashboard) {
            return state;
        }
        // Entering edit mode
        if (!state.editPanel && urlEditPanelId) {
            var panel = dashboard.getPanelByUrlId(urlEditPanelId);
            if (!panel) {
                return __assign(__assign({}, state), { panelNotFound: true });
            }
            if (dashboard.canEditPanel(panel)) {
                return __assign(__assign({}, state), { editPanel: panel });
            }
            else {
                return __assign(__assign({}, state), { editPanelAccessDenied: true });
            }
        }
        // Leaving edit mode
        else if (state.editPanel && !urlEditPanelId) {
            return __assign(__assign({}, state), { editPanel: null });
        }
        // Entering view mode
        if (!state.viewPanel && urlViewPanelId) {
            var panel = dashboard.getPanelByUrlId(urlViewPanelId);
            if (!panel) {
                return __assign(__assign({}, state), { panelNotFound: urlEditPanelId });
            }
            // This mutable state feels wrong to have in getDerivedStateFromProps
            // Should move this state out of dashboard in the future
            dashboard.initViewPanel(panel);
            return __assign(__assign({}, state), { viewPanel: panel, rememberScrollTop: state.scrollTop, updateScrollTop: 0 });
        }
        // Leaving view mode
        else if (state.viewPanel && !urlViewPanelId) {
            // This mutable state feels wrong to have in getDerivedStateFromProps
            // Should move this state out of dashboard in the future
            dashboard.exitViewPanel(state.viewPanel);
            return __assign(__assign({}, state), { viewPanel: null, updateScrollTop: state.rememberScrollTop });
        }
        // if we removed url edit state, clear any panel not found state
        if (state.panelNotFound || (state.editPanelAccessDenied && !urlEditPanelId)) {
            return __assign(__assign({}, state), { panelNotFound: false, editPanelAccessDenied: false });
        }
        return state;
    };
    UnthemedDashboardPage.prototype.getInspectPanel = function () {
        var _a = this.props, dashboard = _a.dashboard, queryParams = _a.queryParams;
        var inspectPanelId = queryParams.inspect;
        if (!dashboard || !inspectPanelId) {
            return null;
        }
        var inspectPanel = dashboard.getPanelById(parseInt(inspectPanelId, 10));
        // cannot inspect panels plugin is not already loaded
        if (!inspectPanel) {
            return null;
        }
        return inspectPanel;
    };
    UnthemedDashboardPage.prototype.render = function () {
        var _a = this.props, dashboard = _a.dashboard, isInitSlow = _a.isInitSlow, initError = _a.initError, queryParams = _a.queryParams, theme = _a.theme;
        var _b = this.state, editPanel = _b.editPanel, viewPanel = _b.viewPanel, scrollTop = _b.scrollTop, updateScrollTop = _b.updateScrollTop;
        var kioskMode = getKioskMode(queryParams.kiosk);
        var styles = getStyles(theme, kioskMode);
        if (!dashboard) {
            if (isInitSlow) {
                return React.createElement(DashboardLoading, { initPhase: this.props.initPhase });
            }
            return null;
        }
        // Only trigger render when the scroll has moved by 25
        var approximateScrollTop = Math.round(scrollTop / 25) * 25;
        var inspectPanel = this.getInspectPanel();
        var containerClassNames = classnames(styles.dashboardContainer, {
            'panel-in-fullscreen': viewPanel,
        });
        var showSubMenu = !editPanel && kioskMode === KioskMode.Off && !this.props.queryParams.editview;
        return (React.createElement("div", { className: containerClassNames },
            kioskMode !== KioskMode.Full && (React.createElement("header", { "aria-label": selectors.pages.Dashboard.DashNav.nav },
                React.createElement(DashNav, { dashboard: dashboard, title: dashboard.title, folderTitle: dashboard.meta.folderTitle, isFullscreen: !!viewPanel, onAddPanel: this.onAddPanel, kioskMode: kioskMode, hideTimePicker: dashboard.timepicker.hidden }))),
            React.createElement(DashboardPrompt, { dashboard: dashboard }),
            React.createElement("div", { className: styles.dashboardScroll },
                React.createElement(CustomScrollbar, { autoHeightMin: "100%", setScrollTop: this.setScrollTop, scrollTop: updateScrollTop, hideHorizontalTrack: true, updateAfterMountMs: 500 },
                    React.createElement("div", { className: styles.dashboardContent },
                        initError && React.createElement(DashboardFailed, null),
                        showSubMenu && (React.createElement("section", { "aria-label": selectors.pages.Dashboard.SubMenu.submenu },
                            React.createElement(SubMenu, { dashboard: dashboard, annotations: dashboard.annotations.list, links: dashboard.links }))),
                        React.createElement(DashboardGrid, { dashboard: dashboard, viewPanel: viewPanel, editPanel: editPanel, scrollTop: approximateScrollTop })))),
            inspectPanel && React.createElement(PanelInspector, { dashboard: dashboard, panel: inspectPanel }),
            editPanel && React.createElement(PanelEditor, { dashboard: dashboard, sourcePanel: editPanel, tab: this.props.queryParams.tab }),
            queryParams.editview && React.createElement(DashboardSettings, { dashboard: dashboard, editview: queryParams.editview })));
    };
    return UnthemedDashboardPage;
}(PureComponent));
export { UnthemedDashboardPage };
/*
 * Styles
 */
export var getStyles = stylesFactory(function (theme, kioskMode) {
    var contentPadding = kioskMode !== KioskMode.Full ? theme.spacing(0, 2, 2) : theme.spacing(2);
    return {
        dashboardContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 100%;\n      height: 100%;\n      display: flex;\n      flex: 1 1 0;\n      flex-direction: column;\n      min-height: 0;\n    "], ["\n      width: 100%;\n      height: 100%;\n      display: flex;\n      flex: 1 1 0;\n      flex-direction: column;\n      min-height: 0;\n    "]))),
        dashboardScroll: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: 100%;\n      flex-grow: 1;\n      min-height: 0;\n      display: flex;\n    "], ["\n      width: 100%;\n      flex-grow: 1;\n      min-height: 0;\n      display: flex;\n    "]))),
        dashboardContent: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      padding: ", ";\n      flex-basis: 100%;\n      flex-grow: 1;\n    "], ["\n      padding: ", ";\n      flex-basis: 100%;\n      flex-grow: 1;\n    "])), contentPadding),
    };
});
export var DashboardPage = withTheme2(UnthemedDashboardPage);
DashboardPage.displayName = 'DashboardPage';
export default connector(DashboardPage);
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=DashboardPage.js.map