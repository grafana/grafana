import { __awaiter, __generator } from "tslib";
import Mousetrap from 'mousetrap';
import 'mousetrap-global-bind';
import { LegacyGraphHoverClearEvent, locationUtil } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { getExploreUrl } from 'app/core/utils/explore';
import { ShareModal } from 'app/features/dashboard/components/ShareModal';
import { SaveDashboardModalProxy } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardModalProxy';
import { locationService } from '@grafana/runtime';
import { exitKioskMode, toggleKioskMode } from '../navigation/kiosk';
import { HideModalEvent, RemovePanelEvent, ShiftTimeEvent, ShiftTimeEventPayload, ShowModalEvent, ShowModalReactEvent, ZoomOutEvent, } from '../../types/events';
import { contextSrv } from '../core';
import { getDatasourceSrv } from '../../features/plugins/datasource_srv';
import { getTimeSrv } from '../../features/dashboard/services/TimeSrv';
import { toggleTheme } from './toggleTheme';
import { withFocusedPanel } from './withFocusedPanelId';
import { HelpModal } from '../components/help/HelpModal';
var KeybindingSrv = /** @class */ (function () {
    function KeybindingSrv() {
        var _this = this;
        this.modalOpen = false;
        appEvents.subscribe(ShowModalEvent, function () { return (_this.modalOpen = true); });
    }
    KeybindingSrv.prototype.reset = function () {
        Mousetrap.reset();
    };
    KeybindingSrv.prototype.initGlobals = function () {
        if (locationService.getLocation().pathname !== '/login') {
            this.bind(['?', 'h'], this.showHelpModal);
            this.bind('g h', this.goToHome);
            this.bind('g a', this.openAlerting);
            this.bind('g p', this.goToProfile);
            this.bind('s o', this.openSearch);
            this.bind('f', this.openSearch);
            this.bind('esc', this.exit);
            this.bindGlobal('esc', this.globalEsc);
        }
        this.bind('t t', function () { return toggleTheme(false); });
        this.bind('t r', function () { return toggleTheme(true); });
    };
    KeybindingSrv.prototype.globalEsc = function () {
        var anyDoc = document;
        var activeElement = anyDoc.activeElement;
        // typehead needs to handle it
        var typeaheads = document.querySelectorAll('.slate-typeahead--open');
        if (typeaheads.length > 0) {
            return;
        }
        // second check if we are in an input we can blur
        if (activeElement && activeElement.blur) {
            if (activeElement.nodeName === 'INPUT' ||
                activeElement.nodeName === 'TEXTAREA' ||
                activeElement.hasAttribute('data-slate-editor')) {
                anyDoc.activeElement.blur();
                return;
            }
        }
        // ok no focused input or editor that should block this, let exist!
        this.exit();
    };
    KeybindingSrv.prototype.openSearch = function () {
        locationService.partial({ search: 'open' });
    };
    KeybindingSrv.prototype.closeSearch = function () {
        locationService.partial({ search: null });
    };
    KeybindingSrv.prototype.openAlerting = function () {
        locationService.push('/alerting');
    };
    KeybindingSrv.prototype.goToHome = function () {
        locationService.push('/');
    };
    KeybindingSrv.prototype.goToProfile = function () {
        locationService.push('/profile');
    };
    KeybindingSrv.prototype.showHelpModal = function () {
        appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
    };
    KeybindingSrv.prototype.exit = function () {
        appEvents.publish(new HideModalEvent());
        if (this.modalOpen) {
            this.modalOpen = false;
            return;
        }
        var search = locationService.getSearchObject();
        if (search.editview) {
            locationService.partial({ editview: null });
            return;
        }
        if (search.inspect) {
            locationService.partial({ inspect: null, inspectTab: null });
            return;
        }
        if (search.editPanel) {
            locationService.partial({ editPanel: null, tab: null });
            return;
        }
        if (search.viewPanel) {
            locationService.partial({ viewPanel: null, tab: null });
            return;
        }
        if (search.kiosk) {
            exitKioskMode();
        }
        if (search.search) {
            this.closeSearch();
        }
    };
    KeybindingSrv.prototype.showDashEditView = function () {
        locationService.partial({
            editview: 'settings',
        });
    };
    KeybindingSrv.prototype.bind = function (keyArg, fn) {
        var _this = this;
        Mousetrap.bind(keyArg, function (evt) {
            evt.preventDefault();
            evt.stopPropagation();
            evt.returnValue = false;
            fn.call(_this);
        }, 'keydown');
    };
    KeybindingSrv.prototype.bindGlobal = function (keyArg, fn) {
        var _this = this;
        Mousetrap.bindGlobal(keyArg, function (evt) {
            evt.preventDefault();
            evt.stopPropagation();
            evt.returnValue = false;
            fn.call(_this);
        }, 'keydown');
    };
    KeybindingSrv.prototype.unbind = function (keyArg, keyType) {
        Mousetrap.unbind(keyArg, keyType);
    };
    KeybindingSrv.prototype.bindWithPanelId = function (keyArg, fn) {
        this.bind(keyArg, withFocusedPanel(fn));
    };
    KeybindingSrv.prototype.setupDashboardBindings = function (dashboard) {
        var _this = this;
        this.bind('mod+o', function () {
            dashboard.graphTooltip = (dashboard.graphTooltip + 1) % 3;
            dashboard.events.publish(new LegacyGraphHoverClearEvent());
            dashboard.startRefresh();
        });
        this.bind('mod+s', function () {
            appEvents.publish(new ShowModalReactEvent({
                component: SaveDashboardModalProxy,
                props: {
                    dashboard: dashboard,
                },
            }));
        });
        this.bind('t z', function () {
            appEvents.publish(new ZoomOutEvent(2));
        });
        this.bind('ctrl+z', function () {
            appEvents.publish(new ZoomOutEvent(2));
        });
        this.bind('t left', function () {
            appEvents.publish(new ShiftTimeEvent(ShiftTimeEventPayload.Left));
        });
        this.bind('t right', function () {
            appEvents.publish(new ShiftTimeEvent(ShiftTimeEventPayload.Right));
        });
        // edit panel
        this.bindWithPanelId('e', function (panelId) {
            if (dashboard.canEditPanelById(panelId)) {
                var isEditing = locationService.getSearchObject().editPanel !== undefined;
                locationService.partial({ editPanel: isEditing ? null : panelId });
            }
        });
        // view panel
        this.bindWithPanelId('v', function (panelId) {
            var isViewing = locationService.getSearchObject().viewPanel !== undefined;
            locationService.partial({ viewPanel: isViewing ? null : panelId });
        });
        this.bindWithPanelId('i', function (panelId) {
            locationService.partial({ inspect: panelId });
        });
        // jump to explore if permissions allow
        if (contextSrv.hasAccessToExplore()) {
            this.bindWithPanelId('x', function (panelId) { return __awaiter(_this, void 0, void 0, function () {
                var panel, url, urlWithoutBase;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            panel = dashboard.getPanelById(panelId);
                            return [4 /*yield*/, getExploreUrl({
                                    panel: panel,
                                    datasourceSrv: getDatasourceSrv(),
                                    timeSrv: getTimeSrv(),
                                })];
                        case 1:
                            url = _a.sent();
                            if (url) {
                                urlWithoutBase = locationUtil.stripBaseFromUrl(url);
                                if (urlWithoutBase) {
                                    locationService.push(urlWithoutBase);
                                }
                            }
                            return [2 /*return*/];
                    }
                });
            }); });
        }
        // delete panel
        this.bindWithPanelId('p r', function (panelId) {
            if (dashboard.canEditPanelById(panelId) && !(dashboard.panelInView || dashboard.panelInEdit)) {
                appEvents.publish(new RemovePanelEvent(panelId));
            }
        });
        // duplicate panel
        this.bindWithPanelId('p d', function (panelId) {
            if (dashboard.canEditPanelById(panelId)) {
                var panelIndex = dashboard.getPanelInfoById(panelId).index;
                dashboard.duplicatePanel(dashboard.panels[panelIndex]);
            }
        });
        // share panel
        this.bindWithPanelId('p s', function (panelId) {
            var panelInfo = dashboard.getPanelInfoById(panelId);
            appEvents.publish(new ShowModalReactEvent({
                component: ShareModal,
                props: {
                    dashboard: dashboard,
                    panel: panelInfo === null || panelInfo === void 0 ? void 0 : panelInfo.panel,
                },
            }));
        });
        // toggle panel legend
        this.bindWithPanelId('p l', function (panelId) {
            var panelInfo = dashboard.getPanelInfoById(panelId);
            if (panelInfo.panel.legend) {
                panelInfo.panel.legend.show = !panelInfo.panel.legend.show;
                panelInfo.panel.render();
            }
        });
        // toggle all panel legends
        this.bind('d l', function () {
            dashboard.toggleLegendsForAll();
        });
        // collapse all rows
        this.bind('d shift+c', function () {
            dashboard.collapseRows();
        });
        // expand all rows
        this.bind('d shift+e', function () {
            dashboard.expandRows();
        });
        this.bind('d n', function () {
            locationService.push('/dashboard/new');
        });
        this.bind('d r', function () {
            dashboard.startRefresh();
        });
        this.bind('d s', function () {
            _this.showDashEditView();
        });
        this.bind('d k', function () {
            toggleKioskMode();
        });
        //Autofit panels
        this.bind('d a', function () {
            // this has to be a full page reload
            var queryParams = locationService.getSearchObject();
            var newUrlParam = queryParams.autofitpanels ? '' : '&autofitpanels';
            window.location.href = window.location.href + newUrlParam;
        });
    };
    return KeybindingSrv;
}());
export { KeybindingSrv };
export var keybindingSrv = new KeybindingSrv();
//# sourceMappingURL=keybindingSrv.js.map