import * as tslib_1 from "tslib";
// Libaries
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
// Utils & Services
import { getAngularLoader } from 'app/core/services/AngularLoader';
import { appEvents } from 'app/core/app_events';
// Components
import { DashNavButton } from './DashNavButton';
import { Tooltip } from '@grafana/ui';
// State
import { updateLocation } from 'app/core/actions';
var DashNav = /** @class */ (function (_super) {
    tslib_1.__extends(DashNav, _super);
    function DashNav(props) {
        var _this = _super.call(this, props) || this;
        _this.onOpenSearch = function () {
            appEvents.emit('show-dash-search');
        };
        _this.onClose = function () {
            if (_this.props.editview) {
                _this.props.updateLocation({
                    query: { editview: null },
                    partial: true,
                });
            }
            else {
                _this.props.updateLocation({
                    query: { panelId: null, edit: null, fullscreen: null, tab: null },
                    partial: true,
                });
            }
        };
        _this.onToggleTVMode = function () {
            appEvents.emit('toggle-kiosk-mode');
        };
        _this.onSave = function () {
            var $injector = _this.props.$injector;
            var dashboardSrv = $injector.get('dashboardSrv');
            dashboardSrv.saveDashboard();
        };
        _this.onOpenSettings = function () {
            _this.props.updateLocation({
                query: { editview: 'settings' },
                partial: true,
            });
        };
        _this.onStarDashboard = function () {
            var _a = _this.props, dashboard = _a.dashboard, $injector = _a.$injector;
            var dashboardSrv = $injector.get('dashboardSrv');
            dashboardSrv.starDashboard(dashboard.id, dashboard.meta.isStarred).then(function (newState) {
                dashboard.meta.isStarred = newState;
                _this.forceUpdate();
            });
        };
        _this.onPlaylistPrev = function () {
            _this.playlistSrv.prev();
        };
        _this.onPlaylistNext = function () {
            _this.playlistSrv.next();
        };
        _this.onPlaylistStop = function () {
            _this.playlistSrv.stop();
            _this.forceUpdate();
        };
        _this.onOpenShare = function () {
            var $rootScope = _this.props.$injector.get('$rootScope');
            var modalScope = $rootScope.$new();
            modalScope.tabIndex = 0;
            modalScope.dashboard = _this.props.dashboard;
            appEvents.emit('show-modal', {
                src: 'public/app/features/dashboard/components/ShareModal/template.html',
                scope: modalScope,
            });
        };
        _this.playlistSrv = _this.props.$injector.get('playlistSrv');
        return _this;
    }
    DashNav.prototype.componentDidMount = function () {
        var loader = getAngularLoader();
        var template = '<gf-time-picker class="gf-timepicker-nav" dashboard="dashboard" ng-if="!dashboard.timepicker.hidden" />';
        var scopeProps = { dashboard: this.props.dashboard };
        this.timepickerCmp = loader.load(this.timePickerEl, scopeProps, template);
    };
    DashNav.prototype.componentWillUnmount = function () {
        if (this.timepickerCmp) {
            this.timepickerCmp.destroy();
        }
    };
    DashNav.prototype.renderDashboardTitleSearchButton = function () {
        var dashboard = this.props.dashboard;
        var folderTitle = dashboard.meta.folderTitle;
        var haveFolder = dashboard.meta.folderId > 0;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", null,
                React.createElement("a", { className: "navbar-page-btn", onClick: this.onOpenSearch },
                    !this.isInFullscreenOrSettings && React.createElement("i", { className: "gicon gicon-dashboard" }),
                    haveFolder && React.createElement("span", { className: "navbar-page-btn--folder" },
                        folderTitle,
                        " / "),
                    dashboard.title,
                    React.createElement("i", { className: "fa fa-caret-down" }))),
            React.createElement("div", { className: "navbar__spacer" })));
    };
    Object.defineProperty(DashNav.prototype, "isInFullscreenOrSettings", {
        get: function () {
            return this.props.editview || this.props.isFullscreen;
        },
        enumerable: true,
        configurable: true
    });
    DashNav.prototype.renderBackButton = function () {
        return (React.createElement("div", { className: "navbar-edit" },
            React.createElement(Tooltip, { content: "Go back (Esc)" },
                React.createElement("button", { className: "navbar-edit__back-btn", onClick: this.onClose },
                    React.createElement("i", { className: "fa fa-arrow-left" })))));
    };
    DashNav.prototype.render = function () {
        var _this = this;
        var _a = this.props, dashboard = _a.dashboard, onAddPanel = _a.onAddPanel;
        var _b = dashboard.meta, canStar = _b.canStar, canSave = _b.canSave, canShare = _b.canShare, showSettings = _b.showSettings, isStarred = _b.isStarred;
        var snapshot = dashboard.snapshot;
        var snapshotUrl = snapshot && snapshot.originalUrl;
        return (React.createElement("div", { className: "navbar" },
            this.isInFullscreenOrSettings && this.renderBackButton(),
            this.renderDashboardTitleSearchButton(),
            this.playlistSrv.isPlaying && (React.createElement("div", { className: "navbar-buttons navbar-buttons--playlist" },
                React.createElement(DashNavButton, { tooltip: "Go to previous dashboard", classSuffix: "tight", icon: "fa fa-step-backward", onClick: this.onPlaylistPrev }),
                React.createElement(DashNavButton, { tooltip: "Stop playlist", classSuffix: "tight", icon: "fa fa-stop", onClick: this.onPlaylistStop }),
                React.createElement(DashNavButton, { tooltip: "Go to next dashboard", classSuffix: "tight", icon: "fa fa-forward", onClick: this.onPlaylistNext }))),
            React.createElement("div", { className: "navbar-buttons navbar-buttons--actions" },
                canSave && (React.createElement(DashNavButton, { tooltip: "Add panel", classSuffix: "add-panel", icon: "gicon gicon-add-panel", onClick: onAddPanel })),
                canStar && (React.createElement(DashNavButton, { tooltip: "Mark as favorite", classSuffix: "star", icon: "" + (isStarred ? 'fa fa-star' : 'fa fa-star-o'), onClick: this.onStarDashboard })),
                canShare && (React.createElement(DashNavButton, { tooltip: "Share dashboard", classSuffix: "share", icon: "fa fa-share-square-o", onClick: this.onOpenShare })),
                canSave && (React.createElement(DashNavButton, { tooltip: "Save dashboard", classSuffix: "save", icon: "fa fa-save", onClick: this.onSave })),
                snapshotUrl && (React.createElement(DashNavButton, { tooltip: "Open original dashboard", classSuffix: "snapshot-origin", icon: "fa fa-link", href: snapshotUrl })),
                showSettings && (React.createElement(DashNavButton, { tooltip: "Dashboard settings", classSuffix: "settings", icon: "fa fa-cog", onClick: this.onOpenSettings }))),
            React.createElement("div", { className: "navbar-buttons navbar-buttons--tv" },
                React.createElement(DashNavButton, { tooltip: "Cycle view mode", classSuffix: "tv", icon: "fa fa-desktop", onClick: this.onToggleTVMode })),
            React.createElement("div", { className: "gf-timepicker-nav", ref: function (element) { return (_this.timePickerEl = element); } })));
    };
    return DashNav;
}(PureComponent));
export { DashNav };
var mapStateToProps = function () { return ({}); };
var mapDispatchToProps = {
    updateLocation: updateLocation,
};
export default connect(mapStateToProps, mapDispatchToProps)(DashNav);
//# sourceMappingURL=DashNav.js.map