import * as tslib_1 from "tslib";
import $ from 'jquery';
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { getExploreUrl } from 'app/core/utils/explore';
import { store } from 'app/store/store';
import Mousetrap from 'mousetrap';
import 'mousetrap-global-bind';
var KeybindingSrv = /** @class */ (function () {
    /** @ngInject */
    function KeybindingSrv($rootScope, $location, $timeout, datasourceSrv, timeSrv, contextSrv) {
        var _this = this;
        this.$rootScope = $rootScope;
        this.$location = $location;
        this.$timeout = $timeout;
        this.datasourceSrv = datasourceSrv;
        this.timeSrv = timeSrv;
        this.contextSrv = contextSrv;
        this.modalOpen = false;
        this.timepickerOpen = false;
        // clear out all shortcuts on route change
        $rootScope.$on('$routeChangeSuccess', function () {
            Mousetrap.reset();
            // rebind global shortcuts
            _this.setupGlobal();
        });
        this.setupGlobal();
        appEvents.on('show-modal', function () { return (_this.modalOpen = true); });
        appEvents.on('timepickerOpen', function () { return (_this.timepickerOpen = true); });
        appEvents.on('timepickerClosed', function () { return (_this.timepickerOpen = false); });
    }
    KeybindingSrv.prototype.setupGlobal = function () {
        this.bind(['?', 'h'], this.showHelpModal);
        this.bind('g h', this.goToHome);
        this.bind('g a', this.openAlerting);
        this.bind('g p', this.goToProfile);
        this.bind('s s', this.openSearchStarred);
        this.bind('s o', this.openSearch);
        this.bind('s t', this.openSearchTags);
        this.bind('f', this.openSearch);
        this.bindGlobal('esc', this.exit);
    };
    KeybindingSrv.prototype.openSearchStarred = function () {
        appEvents.emit('show-dash-search', { starred: true });
    };
    KeybindingSrv.prototype.openSearchTags = function () {
        appEvents.emit('show-dash-search', { tagsMode: true });
    };
    KeybindingSrv.prototype.openSearch = function () {
        appEvents.emit('show-dash-search');
    };
    KeybindingSrv.prototype.openAlerting = function () {
        this.$location.url('/alerting');
    };
    KeybindingSrv.prototype.goToHome = function () {
        this.$location.url('/');
    };
    KeybindingSrv.prototype.goToProfile = function () {
        this.$location.url('/profile');
    };
    KeybindingSrv.prototype.showHelpModal = function () {
        appEvents.emit('show-modal', { templateHtml: '<help-modal></help-modal>' });
    };
    KeybindingSrv.prototype.exit = function () {
        var popups = $('.popover.in');
        if (popups.length > 0) {
            return;
        }
        appEvents.emit('hide-modal');
        if (this.modalOpen) {
            this.modalOpen = false;
            return;
        }
        if (this.timepickerOpen) {
            this.$rootScope.appEvent('closeTimepicker');
            this.timepickerOpen = false;
            return;
        }
        // close settings view
        var search = this.$location.search();
        if (search.editview) {
            delete search.editview;
            this.$location.search(search);
            return;
        }
        if (search.fullscreen) {
            appEvents.emit('panel-change-view', { fullscreen: false, edit: false });
            return;
        }
        if (search.kiosk) {
            this.$rootScope.appEvent('toggle-kiosk-mode', { exit: true });
        }
    };
    KeybindingSrv.prototype.bind = function (keyArg, fn) {
        var _this = this;
        Mousetrap.bind(keyArg, function (evt) {
            evt.preventDefault();
            evt.stopPropagation();
            evt.returnValue = false;
            return _this.$rootScope.$apply(fn.bind(_this));
        }, 'keydown');
    };
    KeybindingSrv.prototype.bindGlobal = function (keyArg, fn) {
        var _this = this;
        Mousetrap.bindGlobal(keyArg, function (evt) {
            evt.preventDefault();
            evt.stopPropagation();
            evt.returnValue = false;
            return _this.$rootScope.$apply(fn.bind(_this));
        }, 'keydown');
    };
    KeybindingSrv.prototype.unbind = function (keyArg, keyType) {
        Mousetrap.unbind(keyArg, keyType);
    };
    KeybindingSrv.prototype.showDashEditView = function () {
        var search = _.extend(this.$location.search(), { editview: 'settings' });
        this.$location.search(search);
    };
    KeybindingSrv.prototype.setupDashboardBindings = function (scope, dashboard) {
        var _this = this;
        this.bind('mod+o', function () {
            dashboard.graphTooltip = (dashboard.graphTooltip + 1) % 3;
            appEvents.emit('graph-hover-clear');
            dashboard.startRefresh();
        });
        this.bind('mod+s', function (e) {
            scope.appEvent('save-dashboard');
        });
        this.bind('t z', function () {
            scope.appEvent('zoom-out', 2);
        });
        this.bind('ctrl+z', function () {
            scope.appEvent('zoom-out', 2);
        });
        this.bind('t left', function () {
            scope.appEvent('shift-time-backward');
        });
        this.bind('t right', function () {
            scope.appEvent('shift-time-forward');
        });
        // edit panel
        this.bind('e', function () {
            if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
                appEvents.emit('panel-change-view', {
                    fullscreen: true,
                    edit: true,
                    panelId: dashboard.meta.focusPanelId,
                    toggle: true,
                });
            }
        });
        // view panel
        this.bind('v', function () {
            if (dashboard.meta.focusPanelId) {
                appEvents.emit('panel-change-view', {
                    fullscreen: true,
                    edit: null,
                    panelId: dashboard.meta.focusPanelId,
                    toggle: true,
                });
            }
        });
        // jump to explore if permissions allow
        if (this.contextSrv.hasAccessToExplore()) {
            this.bind('x', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var panel, datasource, url_1;
                var _this = this;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!dashboard.meta.focusPanelId) return [3 /*break*/, 3];
                            panel = dashboard.getPanelById(dashboard.meta.focusPanelId);
                            return [4 /*yield*/, this.datasourceSrv.get(panel.datasource)];
                        case 1:
                            datasource = _a.sent();
                            return [4 /*yield*/, getExploreUrl(panel, panel.targets, datasource, this.datasourceSrv, this.timeSrv)];
                        case 2:
                            url_1 = _a.sent();
                            if (url_1) {
                                this.$timeout(function () { return _this.$location.url(url_1); });
                            }
                            _a.label = 3;
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
        }
        // delete panel
        this.bind('p r', function () {
            if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
                appEvents.emit('remove-panel', dashboard.meta.focusPanelId);
                dashboard.meta.focusPanelId = 0;
            }
        });
        // duplicate panel
        this.bind('p d', function () {
            if (dashboard.meta.focusPanelId && dashboard.meta.canEdit) {
                var panelIndex = dashboard.getPanelInfoById(dashboard.meta.focusPanelId).index;
                dashboard.duplicatePanel(dashboard.panels[panelIndex]);
            }
        });
        // share panel
        this.bind('p s', function () {
            if (dashboard.meta.focusPanelId) {
                var shareScope = scope.$new();
                var panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
                shareScope.panel = panelInfo.panel;
                shareScope.dashboard = dashboard;
                appEvents.emit('show-modal', {
                    src: 'public/app/features/dashboard/components/ShareModal/template.html',
                    scope: shareScope,
                });
            }
        });
        // toggle panel legend
        this.bind('p l', function () {
            if (dashboard.meta.focusPanelId) {
                var panelInfo = dashboard.getPanelInfoById(dashboard.meta.focusPanelId);
                if (panelInfo.panel.legend) {
                    var panelRef = dashboard.getPanelById(dashboard.meta.focusPanelId);
                    panelRef.legend.show = !panelRef.legend.show;
                    panelRef.render();
                }
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
        this.bind('d n', function (e) {
            _this.$location.url('/dashboard/new');
        });
        this.bind('d r', function () {
            dashboard.startRefresh();
        });
        this.bind('d s', function () {
            _this.showDashEditView();
        });
        this.bind('d k', function () {
            appEvents.emit('toggle-kiosk-mode');
        });
        this.bind('d v', function () {
            appEvents.emit('toggle-view-mode');
        });
        //Autofit panels
        this.bind('d a', function () {
            // this has to be a full page reload
            var queryParams = store.getState().location.query;
            var newUrlParam = queryParams.autofitpanels ? '' : '&autofitpanels';
            window.location.href = window.location.href + newUrlParam;
        });
    };
    return KeybindingSrv;
}());
export { KeybindingSrv };
coreModule.service('keybindingSrv', KeybindingSrv);
/**
 * Code below exports the service to react components
 */
var singletonInstance;
export function setKeybindingSrv(instance) {
    singletonInstance = instance;
}
export function getKeybindingSrv() {
    return singletonInstance;
}
//# sourceMappingURL=keybindingSrv.js.map