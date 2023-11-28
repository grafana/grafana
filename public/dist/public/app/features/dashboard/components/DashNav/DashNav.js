import { css } from '@emotion/css';
import React from 'react';
import { connect } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { textUtil } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { locationService } from '@grafana/runtime';
import { ButtonGroup, ModalsController, ToolbarButton, useForceUpdate, Tag, ToolbarButtonRow, ConfirmModal, } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import config from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { appEvents } from 'app/core/core';
import { useBusEvent } from 'app/core/hooks/useBusEvent';
import { t, Trans } from 'app/core/internationalization';
import { setStarred } from 'app/core/reducers/navBarTree';
import AddPanelButton from 'app/features/dashboard/components/AddPanelButton/AddPanelButton';
import { SaveDashboardDrawer } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDrawer';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { KioskMode } from 'app/types';
import { DashboardMetaChangedEvent, ShowModalReactEvent } from 'app/types/events';
import { DashNavButton } from './DashNavButton';
import { DashNavTimeControls } from './DashNavTimeControls';
import { ShareButton } from './ShareButton';
const mapDispatchToProps = {
    setStarred,
    updateTimeZoneForSession,
};
const connector = connect(null, mapDispatchToProps);
const selectors = e2eSelectors.pages.Dashboard.DashNav;
const customLeftActions = [];
const customRightActions = [];
export function addCustomLeftAction(content) {
    customLeftActions.push(content);
}
export function addCustomRightAction(content) {
    customRightActions.push(content);
}
export const DashNav = React.memo((props) => {
    var _a, _b;
    // this ensures the component rerenders when the location changes
    useLocation();
    const forceUpdate = useForceUpdate();
    // We don't really care about the event payload here only that it triggeres a re-render of this component
    useBusEvent(props.dashboard.events, DashboardMetaChangedEvent);
    const originalUrl = (_b = (_a = props.dashboard.snapshot) === null || _a === void 0 ? void 0 : _a.originalUrl) !== null && _b !== void 0 ? _b : '';
    const gotoSnapshotOrigin = () => {
        window.location.href = textUtil.sanitizeUrl(props.dashboard.snapshot.originalUrl);
    };
    const notifyApp = useAppNotification();
    const onOpenSnapshotOriginal = () => {
        try {
            const sanitizedUrl = new URL(textUtil.sanitizeUrl(originalUrl), config.appUrl);
            const appUrl = new URL(config.appUrl);
            if (sanitizedUrl.host !== appUrl.host) {
                appEvents.publish(new ShowModalReactEvent({
                    component: ConfirmModal,
                    props: {
                        title: 'Proceed to external site?',
                        modalClass: modalStyles,
                        body: (React.createElement(React.Fragment, null,
                            React.createElement("p", null,
                                `This link connects to an external website at`,
                                " ",
                                React.createElement("code", null, originalUrl)),
                            React.createElement("p", null, "Are you sure you'd like to proceed?"))),
                        confirmVariant: 'primary',
                        confirmText: 'Proceed',
                        onConfirm: gotoSnapshotOrigin,
                    },
                }));
            }
            else {
                gotoSnapshotOrigin();
            }
        }
        catch (err) {
            notifyApp.error('Invalid URL', err instanceof Error ? err.message : undefined);
        }
    };
    const onStarDashboard = () => {
        const dashboardSrv = getDashboardSrv();
        const { dashboard, setStarred } = props;
        dashboardSrv.starDashboard(dashboard.uid, Boolean(dashboard.meta.isStarred)).then((newState) => {
            var _a;
            setStarred({ id: dashboard.uid, title: dashboard.title, url: (_a = dashboard.meta.url) !== null && _a !== void 0 ? _a : '', isStarred: newState });
            dashboard.meta.isStarred = newState;
            forceUpdate();
        });
    };
    const onOpenSettings = () => {
        locationService.partial({ editview: 'settings' });
    };
    const onPlaylistPrev = () => {
        playlistSrv.prev();
    };
    const onPlaylistNext = () => {
        playlistSrv.next();
    };
    const onPlaylistStop = () => {
        playlistSrv.stop();
        forceUpdate();
    };
    const addCustomContent = (actions, buttons) => {
        actions.map((action, index) => {
            const Component = action.component;
            const element = React.createElement(Component, Object.assign({}, props, { key: `button-custom-${index}` }));
            typeof action.index === 'number' ? buttons.splice(action.index, 0, element) : buttons.push(element);
        });
    };
    const isPlaylistRunning = () => {
        return playlistSrv.isPlaying;
    };
    const renderLeftActions = () => {
        const { dashboard, kioskMode } = props;
        const { canStar, canShare, isStarred } = dashboard.meta;
        const buttons = [];
        if (kioskMode || isPlaylistRunning()) {
            return [];
        }
        if (canStar) {
            let desc = isStarred
                ? t('dashboard.toolbar.unmark-favorite', 'Unmark as favorite')
                : t('dashboard.toolbar.mark-favorite', 'Mark as favorite');
            buttons.push(React.createElement(DashNavButton, { tooltip: desc, icon: isStarred ? 'favorite' : 'star', iconType: isStarred ? 'mono' : 'default', iconSize: "lg", onClick: onStarDashboard, key: "button-star" }));
        }
        if (canShare) {
            buttons.push(React.createElement(ShareButton, { key: "button-share", dashboard: dashboard }));
        }
        if (dashboard.meta.publicDashboardEnabled) {
            buttons.push(React.createElement(Tag, { key: "public-dashboard", name: "Public", colorIndex: 5, "data-testid": selectors.publicDashboardTag }));
        }
        if (config.featureToggles.scenes) {
            buttons.push(React.createElement(DashNavButton, { key: "button-scenes", tooltip: 'View as Scene', icon: "apps", onClick: () => {
                    const location = locationService.getLocation();
                    locationService.push(`/scenes/dashboard/${dashboard.uid}${location.search}`);
                } }));
        }
        addCustomContent(customLeftActions, buttons);
        return buttons;
    };
    const renderPlaylistControls = () => {
        return (React.createElement(ButtonGroup, { key: "playlist-buttons" },
            React.createElement(ToolbarButton, { tooltip: t('dashboard.toolbar.playlist-previous', 'Go to previous dashboard'), icon: "backward", onClick: onPlaylistPrev, narrow: true }),
            React.createElement(ToolbarButton, { onClick: onPlaylistStop },
                React.createElement(Trans, { i18nKey: "dashboard.toolbar.playlist-stop" }, "Stop playlist")),
            React.createElement(ToolbarButton, { tooltip: t('dashboard.toolbar.playlist-next', 'Go to next dashboard'), icon: "forward", onClick: onPlaylistNext, narrow: true })));
    };
    const renderTimeControls = () => {
        const { dashboard, updateTimeZoneForSession, hideTimePicker } = props;
        if (hideTimePicker) {
            return null;
        }
        return (React.createElement(DashNavTimeControls, { dashboard: dashboard, onChangeTimeZone: updateTimeZoneForSession, key: "time-controls" }));
    };
    const renderRightActions = () => {
        const { dashboard, onAddPanel, isFullscreen, kioskMode } = props;
        const { canSave, canEdit, showSettings } = dashboard.meta;
        const { snapshot } = dashboard;
        const snapshotUrl = snapshot && snapshot.originalUrl;
        const buttons = [];
        if (isPlaylistRunning()) {
            return [renderPlaylistControls(), renderTimeControls()];
        }
        if (kioskMode === KioskMode.TV) {
            return [renderTimeControls()];
        }
        if (canEdit && !isFullscreen) {
            if (config.featureToggles.emptyDashboardPage) {
                buttons.push(React.createElement(AddPanelButton, { dashboard: dashboard, key: "panel-add-dropdown" }));
            }
            else {
                buttons.push(React.createElement(ToolbarButton, { tooltip: t('dashboard.toolbar.add-panel', 'Add panel'), icon: "panel-add", iconSize: "xl", onClick: onAddPanel, key: "button-panel-add" }));
            }
        }
        if (canSave && !isFullscreen) {
            buttons.push(React.createElement(ModalsController, { key: "button-save" }, ({ showModal, hideModal }) => (React.createElement(ToolbarButton, { tooltip: t('dashboard.toolbar.save', 'Save dashboard'), icon: "save", onClick: () => {
                    showModal(SaveDashboardDrawer, {
                        dashboard,
                        onDismiss: hideModal,
                    });
                } }))));
        }
        if (snapshotUrl) {
            buttons.push(React.createElement(ToolbarButton, { tooltip: t('dashboard.toolbar.open-original', 'Open original dashboard'), onClick: onOpenSnapshotOriginal, icon: "link", key: "button-snapshot" }));
        }
        if (showSettings) {
            buttons.push(React.createElement(ToolbarButton, { tooltip: t('dashboard.toolbar.settings', 'Dashboard settings'), icon: "cog", onClick: onOpenSettings, key: "button-settings" }));
        }
        addCustomContent(customRightActions, buttons);
        buttons.push(renderTimeControls());
        return buttons;
    };
    return (React.createElement(AppChromeUpdate, { actions: React.createElement(React.Fragment, null,
            renderLeftActions(),
            React.createElement(NavToolbarSeparator, { leftActionsSeparator: true }),
            React.createElement(ToolbarButtonRow, { alignment: "right" }, renderRightActions())) }));
});
DashNav.displayName = 'DashNav';
export default connector(DashNav);
const modalStyles = css({
    width: 'max-content',
    maxWidth: '80vw',
});
//# sourceMappingURL=DashNav.js.map