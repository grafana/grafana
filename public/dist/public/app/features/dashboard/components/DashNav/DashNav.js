import { __assign, __extends } from "tslib";
// Libaries
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
// Utils & Services
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
// Components
import { DashNavButton } from './DashNavButton';
import { DashNavTimeControls } from './DashNavTimeControls';
import { ButtonGroup, ModalsController, ToolbarButton, PageToolbar } from '@grafana/ui';
import { locationUtil, textUtil } from '@grafana/data';
// State
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { KioskMode } from 'app/types';
import { ShareModal } from 'app/features/dashboard/components/ShareModal';
import { SaveDashboardModalProxy } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardModalProxy';
import { locationService } from '@grafana/runtime';
import { toggleKioskMode } from 'app/core/navigation/kiosk';
import { getDashboardSrv } from '../../services/DashboardSrv';
var mapDispatchToProps = {
    updateTimeZoneForSession: updateTimeZoneForSession,
};
var connector = connect(null, mapDispatchToProps);
var customLeftActions = [];
var customRightActions = [];
export function addCustomLeftAction(content) {
    customLeftActions.push(content);
}
export function addCustomRightAction(content) {
    customRightActions.push(content);
}
var DashNav = /** @class */ (function (_super) {
    __extends(DashNav, _super);
    function DashNav(props) {
        var _this = _super.call(this, props) || this;
        _this.onClose = function () {
            locationService.partial({ viewPanel: null });
        };
        _this.onToggleTVMode = function () {
            toggleKioskMode();
        };
        _this.onOpenSettings = function () {
            locationService.partial({ editview: 'settings' });
        };
        _this.onStarDashboard = function () {
            var dashboard = _this.props.dashboard;
            var dashboardSrv = getDashboardSrv();
            dashboardSrv.starDashboard(dashboard.id, dashboard.meta.isStarred).then(function (newState) {
                dashboard.meta.isStarred = newState;
                _this.forceUpdate();
            });
        };
        _this.onPlaylistPrev = function () {
            playlistSrv.prev();
        };
        _this.onPlaylistNext = function () {
            playlistSrv.next();
        };
        _this.onPlaylistStop = function () {
            playlistSrv.stop();
            _this.forceUpdate();
        };
        return _this;
    }
    DashNav.prototype.addCustomContent = function (actions, buttons) {
        var _this = this;
        actions.map(function (action, index) {
            var Component = action.component;
            var element = React.createElement(Component, __assign({}, _this.props, { key: "button-custom-" + index }));
            typeof action.index === 'number' ? buttons.splice(action.index, 0, element) : buttons.push(element);
        });
    };
    DashNav.prototype.isPlaylistRunning = function () {
        return playlistSrv.isPlaying;
    };
    DashNav.prototype.renderLeftActionsButton = function () {
        var _a = this.props, dashboard = _a.dashboard, kioskMode = _a.kioskMode;
        var _b = dashboard.meta, canStar = _b.canStar, canShare = _b.canShare, isStarred = _b.isStarred;
        var buttons = [];
        if (kioskMode !== KioskMode.Off || this.isPlaylistRunning()) {
            return [];
        }
        if (canStar) {
            var desc = isStarred ? 'Unmark as favorite' : 'Mark as favorite';
            buttons.push(React.createElement(DashNavButton, { tooltip: desc, icon: isStarred ? 'favorite' : 'star', iconType: isStarred ? 'mono' : 'default', iconSize: "lg", onClick: this.onStarDashboard, key: "button-star" }));
        }
        if (canShare) {
            var desc_1 = 'Share dashboard or panel';
            buttons.push(React.createElement(ModalsController, { key: "button-share" }, function (_a) {
                var showModal = _a.showModal, hideModal = _a.hideModal;
                return (React.createElement(DashNavButton, { tooltip: desc_1, icon: "share-alt", iconSize: "lg", onClick: function () {
                        showModal(ShareModal, {
                            dashboard: dashboard,
                            onDismiss: hideModal,
                        });
                    } }));
            }));
        }
        this.addCustomContent(customLeftActions, buttons);
        return buttons;
    };
    DashNav.prototype.renderPlaylistControls = function () {
        return (React.createElement(ButtonGroup, { key: "playlist-buttons" },
            React.createElement(ToolbarButton, { tooltip: "Go to previous dashboard", icon: "backward", onClick: this.onPlaylistPrev, narrow: true }),
            React.createElement(ToolbarButton, { onClick: this.onPlaylistStop }, "Stop playlist"),
            React.createElement(ToolbarButton, { tooltip: "Go to next dashboard", icon: "forward", onClick: this.onPlaylistNext, narrow: true })));
    };
    DashNav.prototype.renderTimeControls = function () {
        var _a = this.props, dashboard = _a.dashboard, updateTimeZoneForSession = _a.updateTimeZoneForSession, hideTimePicker = _a.hideTimePicker;
        if (hideTimePicker) {
            return null;
        }
        return (React.createElement(DashNavTimeControls, { dashboard: dashboard, onChangeTimeZone: updateTimeZoneForSession, key: "time-controls" }));
    };
    DashNav.prototype.renderRightActionsButton = function () {
        var _this = this;
        var _a = this.props, dashboard = _a.dashboard, onAddPanel = _a.onAddPanel, isFullscreen = _a.isFullscreen, kioskMode = _a.kioskMode;
        var _b = dashboard.meta, canEdit = _b.canEdit, showSettings = _b.showSettings;
        var snapshot = dashboard.snapshot;
        var snapshotUrl = snapshot && snapshot.originalUrl;
        var buttons = [];
        var tvButton = (React.createElement(ToolbarButton, { tooltip: "Cycle view mode", icon: "monitor", onClick: this.onToggleTVMode, key: "tv-button" }));
        if (this.isPlaylistRunning()) {
            return [this.renderPlaylistControls(), this.renderTimeControls()];
        }
        if (kioskMode === KioskMode.TV) {
            return [this.renderTimeControls(), tvButton];
        }
        if (canEdit && !isFullscreen) {
            buttons.push(React.createElement(ToolbarButton, { tooltip: "Add panel", icon: "panel-add", onClick: onAddPanel, key: "button-panel-add" }));
            buttons.push(React.createElement(ModalsController, { key: "button-save" }, function (_a) {
                var showModal = _a.showModal, hideModal = _a.hideModal;
                return (React.createElement(ToolbarButton, { tooltip: "Save dashboard", icon: "save", onClick: function () {
                        showModal(SaveDashboardModalProxy, {
                            dashboard: dashboard,
                            onDismiss: hideModal,
                        });
                    } }));
            }));
        }
        if (snapshotUrl) {
            buttons.push(React.createElement(ToolbarButton, { tooltip: "Open original dashboard", onClick: function () { return _this.gotoSnapshotOrigin(snapshotUrl); }, icon: "link", key: "button-snapshot" }));
        }
        if (showSettings) {
            buttons.push(React.createElement(ToolbarButton, { tooltip: "Dashboard settings", icon: "cog", onClick: this.onOpenSettings, key: "button-settings" }));
        }
        this.addCustomContent(customRightActions, buttons);
        buttons.push(this.renderTimeControls());
        buttons.push(tvButton);
        return buttons;
    };
    DashNav.prototype.gotoSnapshotOrigin = function (snapshotUrl) {
        window.location.href = textUtil.sanitizeUrl(snapshotUrl);
    };
    DashNav.prototype.render = function () {
        var _a = this.props, isFullscreen = _a.isFullscreen, title = _a.title, folderTitle = _a.folderTitle;
        var onGoBack = isFullscreen ? this.onClose : undefined;
        var titleHref = locationUtil.updateSearchParams(window.location.href, '?search=open');
        var parentHref = locationUtil.updateSearchParams(window.location.href, '?search=open&folder=current');
        return (React.createElement(PageToolbar, { pageIcon: isFullscreen ? undefined : 'apps', title: title, parent: folderTitle, titleHref: titleHref, parentHref: parentHref, onGoBack: onGoBack, leftItems: this.renderLeftActionsButton() }, this.renderRightActionsButton()));
    };
    return DashNav;
}(PureComponent));
export default connector(DashNav);
//# sourceMappingURL=DashNav.js.map