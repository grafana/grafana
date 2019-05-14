import * as tslib_1 from "tslib";
// Libraries
import _ from 'lodash';
import $ from 'jquery';
import Drop from 'tether-drop';
// Utils and servies
import { colors } from '@grafana/ui';
import config from 'app/core/config';
import coreModule from 'app/core/core_module';
import { profiler } from 'app/core/profiler';
import appEvents from 'app/core/app_events';
import { setBackendSrv } from 'app/core/services/backend_srv';
import { setTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { setDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { setKeybindingSrv } from 'app/core/services/keybindingSrv';
import { setAngularLoader } from 'app/core/services/AngularLoader';
import { configureStore } from 'app/store/configureStore';
var GrafanaCtrl = /** @class */ (function () {
    /** @ngInject */
    function GrafanaCtrl($scope, utilSrv, $rootScope, $controller, contextSrv, bridgeSrv, backendSrv, timeSrv, datasourceSrv, keybindingSrv, angularLoader) {
        // make angular loader service available to react components
        setAngularLoader(angularLoader);
        setBackendSrv(backendSrv);
        setDatasourceSrv(datasourceSrv);
        setTimeSrv(timeSrv);
        setKeybindingSrv(keybindingSrv);
        configureStore();
        $scope.init = function () {
            $scope.contextSrv = contextSrv;
            $scope.appSubUrl = config.appSubUrl;
            $scope._ = _;
            profiler.init(config, $rootScope);
            utilSrv.init();
            bridgeSrv.init();
        };
        $rootScope.colors = colors;
        $rootScope.onAppEvent = function (name, callback, localScope) {
            var unbind = $rootScope.$on(name, callback);
            var callerScope = this;
            if (callerScope.$id === 1 && !localScope) {
                console.log('warning rootScope onAppEvent called without localscope');
            }
            if (localScope) {
                callerScope = localScope;
            }
            callerScope.$on('$destroy', unbind);
        };
        $rootScope.appEvent = function (name, payload) {
            $rootScope.$emit(name, payload);
            appEvents.emit(name, payload);
        };
        $scope.init();
    }
    return GrafanaCtrl;
}());
export { GrafanaCtrl };
function setViewModeBodyClass(body, mode) {
    body.removeClass('view-mode--tv');
    body.removeClass('view-mode--kiosk');
    body.removeClass('view-mode--inactive');
    switch (mode) {
        case 'tv': {
            body.addClass('view-mode--tv');
            break;
        }
        // 1 & true for legacy states
        case '1':
        case true: {
            body.addClass('view-mode--kiosk');
            break;
        }
    }
}
/** @ngInject */
export function grafanaAppDirective(playlistSrv, contextSrv, $timeout, $rootScope, $location) {
    return {
        restrict: 'E',
        controller: GrafanaCtrl,
        link: function (scope, elem) {
            var body = $('body');
            // see https://github.com/zenorocha/clipboard.js/issues/155
            $.fn.modal.Constructor.prototype.enforceFocus = function () { };
            $('.preloader').remove();
            appEvents.on('toggle-sidemenu-mobile', function () {
                body.toggleClass('sidemenu-open--xs');
            });
            appEvents.on('toggle-sidemenu-hidden', function () {
                body.toggleClass('sidemenu-hidden');
            });
            appEvents.on('playlist-started', function () {
                elem.toggleClass('view-mode--playlist', true);
            });
            appEvents.on('playlist-stopped', function () {
                elem.toggleClass('view-mode--playlist', false);
            });
            // check if we are in server side render
            if (document.cookie.indexOf('renderKey') !== -1) {
                body.addClass('body--phantomjs');
            }
            // tooltip removal fix
            // manage page classes
            var pageClass;
            scope.$on('$routeChangeSuccess', function (evt, data) {
                var e_1, _a;
                if (pageClass) {
                    body.removeClass(pageClass);
                }
                if (data.$$route) {
                    pageClass = data.$$route.pageClass;
                    if (pageClass) {
                        body.addClass(pageClass);
                    }
                }
                // clear body class sidemenu states
                body.removeClass('sidemenu-open--xs');
                $('#tooltip, .tooltip').remove();
                // check for kiosk url param
                setViewModeBodyClass(body, data.params.kiosk);
                try {
                    // close all drops
                    for (var _b = tslib_1.__values(Drop.drops), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var drop = _c.value;
                        drop.destroy();
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                appEvents.emit('hide-dash-search');
            });
            // handle kiosk mode
            appEvents.on('toggle-kiosk-mode', function (options) {
                var search = $location.search();
                if (options && options.exit) {
                    search.kiosk = '1';
                }
                switch (search.kiosk) {
                    case 'tv': {
                        search.kiosk = true;
                        appEvents.emit('alert-success', ['Press ESC to exit Kiosk mode']);
                        break;
                    }
                    case '1':
                    case true: {
                        delete search.kiosk;
                        break;
                    }
                    default: {
                        search.kiosk = 'tv';
                    }
                }
                $timeout(function () { return $location.search(search); });
                setViewModeBodyClass(body, search.kiosk);
            });
            // handle in active view state class
            var lastActivity = new Date().getTime();
            var activeUser = true;
            var inActiveTimeLimit = 60 * 5000;
            function checkForInActiveUser() {
                if (!activeUser) {
                    return;
                }
                // only go to activity low mode on dashboard page
                if (!body.hasClass('page-dashboard')) {
                    return;
                }
                if (new Date().getTime() - lastActivity > inActiveTimeLimit) {
                    activeUser = false;
                    body.addClass('view-mode--inactive');
                }
            }
            function userActivityDetected() {
                lastActivity = new Date().getTime();
                if (!activeUser) {
                    activeUser = true;
                    body.removeClass('view-mode--inactive');
                }
            }
            // mouse and keyboard is user activity
            body.mousemove(userActivityDetected);
            body.keydown(userActivityDetected);
            // set useCapture = true to catch event here
            document.addEventListener('wheel', userActivityDetected, { capture: true, passive: true });
            // treat tab change as activity
            document.addEventListener('visibilitychange', userActivityDetected);
            // check every 2 seconds
            setInterval(checkForInActiveUser, 2000);
            appEvents.on('toggle-view-mode', function () {
                lastActivity = 0;
                checkForInActiveUser();
            });
            // handle document clicks that should hide things
            body.click(function (evt) {
                var target = $(evt.target);
                if (target.parents().length === 0) {
                    return;
                }
                // ensure dropdown menu doesn't impact on z-index
                body.find('.dropdown-menu-open').removeClass('dropdown-menu-open');
                // for stuff that animates, slides out etc, clicking it needs to
                // hide it right away
                var clickAutoHide = target.closest('[data-click-hide]');
                if (clickAutoHide.length) {
                    var clickAutoHideParent_1 = clickAutoHide.parent();
                    clickAutoHide.detach();
                    setTimeout(function () {
                        clickAutoHideParent_1.append(clickAutoHide);
                    }, 100);
                }
                // hide search
                if (body.find('.search-container').length > 0) {
                    if (target.parents('.search-results-container, .search-field-wrapper').length === 0) {
                        scope.$apply(function () {
                            scope.appEvent('hide-dash-search');
                        });
                    }
                }
                // hide popovers
                var popover = elem.find('.popover');
                if (popover.length > 0 && target.parents('.graph-legend').length === 0) {
                    popover.hide();
                }
                // hide time picker
                var timePickerDropDownIsOpen = elem.find('.gf-timepicker-dropdown').length > 0;
                if (timePickerDropDownIsOpen) {
                    var targetIsInTimePickerDropDown = target.parents('.gf-timepicker-dropdown').length > 0;
                    var targetIsInTimePickerNav = target.parents('.gf-timepicker-nav').length > 0;
                    var targetIsDatePickerRowBtn = target.parents('td[id^="datepicker-"]').length > 0;
                    var targetIsDatePickerHeaderBtn = target.parents('button[id^="datepicker-"]').length > 0;
                    if (targetIsInTimePickerNav ||
                        targetIsInTimePickerDropDown ||
                        targetIsDatePickerRowBtn ||
                        targetIsDatePickerHeaderBtn) {
                        return;
                    }
                    scope.$apply(function () {
                        scope.appEvent('closeTimepicker');
                    });
                }
            });
        },
    };
}
coreModule.directive('grafanaApp', grafanaAppDirective);
//# sourceMappingURL=GrafanaCtrl.js.map