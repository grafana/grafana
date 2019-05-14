import * as tslib_1 from "tslib";
// Libraries
import $ from 'jquery';
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import classNames from 'classnames';
// Services & Utils
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getMessageFromError } from 'app/core/utils/errors';
// Components
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { DashNav } from '../components/DashNav';
import { SubMenu } from '../components/SubMenu';
import { DashboardSettings } from '../components/DashboardSettings';
import { CustomScrollbar } from '@grafana/ui';
import { AlertBox } from 'app/core/components/AlertBox/AlertBox';
// Redux
import { initDashboard } from '../state/initDashboard';
import { cleanUpDashboard } from '../state/actions';
import { updateLocation } from 'app/core/actions';
import { notifyApp } from 'app/core/actions';
// Types
import { AppNotificationSeverity, } from 'app/types';
var DashboardPage = /** @class */ (function (_super) {
    tslib_1.__extends(DashboardPage, _super);
    function DashboardPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            isSettingsOpening: false,
            isEditing: false,
            isFullscreen: false,
            showLoadingState: false,
            fullscreenPanel: null,
            scrollTop: 0,
            rememberScrollTop: 0,
        };
        _this.setScrollTop = function (e) {
            var target = e.target;
            _this.setState({ scrollTop: target.scrollTop });
        };
        _this.onAddPanel = function () {
            var dashboard = _this.props.dashboard;
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
            _this.setState({ scrollTop: 0 });
        };
        return _this;
    }
    DashboardPage.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
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
                return [2 /*return*/];
            });
        });
    };
    DashboardPage.prototype.componentWillUnmount = function () {
        if (this.props.dashboard) {
            this.props.cleanUpDashboard();
            this.setPanelFullscreenClass(false);
        }
    };
    DashboardPage.prototype.componentDidUpdate = function (prevProps) {
        var _this = this;
        var _a = this.props, dashboard = _a.dashboard, editview = _a.editview, urlEdit = _a.urlEdit, urlFullscreen = _a.urlFullscreen, urlPanelId = _a.urlPanelId, urlUid = _a.urlUid;
        if (!dashboard) {
            return;
        }
        // if we just got dashboard update title
        if (!prevProps.dashboard) {
            document.title = dashboard.title + ' - Grafana';
        }
        // Due to the angular -> react url bridge we can ge an update here with new uid before the container unmounts
        // Can remove this condition after we switch to react router
        if (prevProps.urlUid !== urlUid) {
            return;
        }
        // handle animation states when opening dashboard settings
        if (!prevProps.editview && editview) {
            this.setState({ isSettingsOpening: true });
            setTimeout(function () {
                _this.setState({ isSettingsOpening: false });
            }, 10);
        }
        // Sync url state with model
        if (urlFullscreen !== dashboard.meta.fullscreen || urlEdit !== dashboard.meta.isEditing) {
            if (!isNaN(parseInt(urlPanelId, 10))) {
                this.onEnterFullscreen();
            }
            else {
                this.onLeaveFullscreen();
            }
        }
    };
    DashboardPage.prototype.onEnterFullscreen = function () {
        var _a = this.props, dashboard = _a.dashboard, urlEdit = _a.urlEdit, urlFullscreen = _a.urlFullscreen, urlPanelId = _a.urlPanelId;
        var panelId = parseInt(urlPanelId, 10);
        // need to expand parent row if this panel is inside a row
        dashboard.expandParentRowFor(panelId);
        var panel = dashboard.getPanelById(panelId);
        if (panel) {
            dashboard.setViewMode(panel, urlFullscreen, urlEdit);
            this.setState({
                isEditing: urlEdit && dashboard.meta.canEdit,
                isFullscreen: urlFullscreen,
                fullscreenPanel: panel,
                rememberScrollTop: this.state.scrollTop,
            });
            this.setPanelFullscreenClass(urlFullscreen);
        }
        else {
            this.handleFullscreenPanelNotFound(urlPanelId);
        }
    };
    DashboardPage.prototype.onLeaveFullscreen = function () {
        var dashboard = this.props.dashboard;
        if (this.state.fullscreenPanel) {
            dashboard.setViewMode(this.state.fullscreenPanel, false, false);
        }
        this.setState({
            isEditing: false,
            isFullscreen: false,
            fullscreenPanel: null,
            scrollTop: this.state.rememberScrollTop,
        }, this.triggerPanelsRendering.bind(this));
        this.setPanelFullscreenClass(false);
    };
    DashboardPage.prototype.triggerPanelsRendering = function () {
        try {
            this.props.dashboard.render();
        }
        catch (err) {
            this.props.notifyApp(createErrorNotification("Panel rendering error", err));
        }
    };
    DashboardPage.prototype.handleFullscreenPanelNotFound = function (urlPanelId) {
        // Panel not found
        this.props.notifyApp(createErrorNotification("Panel with id " + urlPanelId + " not found"));
        // Clear url state
        this.props.updateLocation({
            query: {
                edit: null,
                fullscreen: null,
                panelId: null,
            },
            partial: true,
        });
    };
    DashboardPage.prototype.setPanelFullscreenClass = function (isFullscreen) {
        $('body').toggleClass('panel-in-fullscreen', isFullscreen);
    };
    DashboardPage.prototype.renderSlowInitState = function () {
        return (React.createElement("div", { className: "dashboard-loading" },
            React.createElement("div", { className: "dashboard-loading__text" },
                React.createElement("i", { className: "fa fa-spinner fa-spin" }),
                " ",
                this.props.initPhase)));
    };
    DashboardPage.prototype.renderInitFailedState = function () {
        var initError = this.props.initError;
        return (React.createElement("div", { className: "dashboard-loading" },
            React.createElement(AlertBox, { severity: AppNotificationSeverity.Error, title: initError.message, text: getMessageFromError(initError.error) })));
    };
    DashboardPage.prototype.render = function () {
        var _a = this.props, dashboard = _a.dashboard, editview = _a.editview, $injector = _a.$injector, isInitSlow = _a.isInitSlow, initError = _a.initError;
        var _b = this.state, isSettingsOpening = _b.isSettingsOpening, isEditing = _b.isEditing, isFullscreen = _b.isFullscreen, scrollTop = _b.scrollTop;
        if (!dashboard) {
            if (isInitSlow) {
                return this.renderSlowInitState();
            }
            return null;
        }
        var classes = classNames({
            'dashboard-page--settings-opening': isSettingsOpening,
            'dashboard-page--settings-open': !isSettingsOpening && editview,
        });
        var gridWrapperClasses = classNames({
            'dashboard-container': true,
            'dashboard-container--has-submenu': dashboard.meta.submenuEnabled,
        });
        return (React.createElement("div", { className: classes },
            React.createElement(DashNav, { dashboard: dashboard, isEditing: isEditing, isFullscreen: isFullscreen, editview: editview, "$injector": $injector, onAddPanel: this.onAddPanel }),
            React.createElement("div", { className: "scroll-canvas scroll-canvas--dashboard" },
                React.createElement(CustomScrollbar, { autoHeightMin: '100%', setScrollTop: this.setScrollTop, scrollTop: scrollTop, updateAfterMountMs: 500, className: "custom-scrollbar--page" },
                    editview && React.createElement(DashboardSettings, { dashboard: dashboard }),
                    initError && this.renderInitFailedState(),
                    React.createElement("div", { className: gridWrapperClasses },
                        dashboard.meta.submenuEnabled && React.createElement(SubMenu, { dashboard: dashboard }),
                        React.createElement(DashboardGrid, { dashboard: dashboard, isEditing: isEditing, isFullscreen: isFullscreen }))))));
    };
    return DashboardPage;
}(PureComponent));
export { DashboardPage };
export var mapStateToProps = function (state) { return ({
    urlUid: state.location.routeParams.uid,
    urlSlug: state.location.routeParams.slug,
    urlType: state.location.routeParams.type,
    editview: state.location.query.editview,
    urlPanelId: state.location.query.panelId,
    urlFolderId: state.location.query.folderId,
    urlFullscreen: !!state.location.query.fullscreen,
    urlEdit: !!state.location.query.edit,
    initPhase: state.dashboard.initPhase,
    isInitSlow: state.dashboard.isInitSlow,
    initError: state.dashboard.initError,
    dashboard: state.dashboard.model,
}); };
var mapDispatchToProps = {
    initDashboard: initDashboard,
    cleanUpDashboard: cleanUpDashboard,
    notifyApp: notifyApp,
    updateLocation: updateLocation,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DashboardPage));
//# sourceMappingURL=DashboardPage.js.map