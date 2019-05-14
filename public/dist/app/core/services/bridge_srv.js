import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { store } from 'app/store/store';
import locationUtil from 'app/core/utils/location_util';
import { updateLocation } from 'app/core/actions';
// Services that handles angular -> redux store sync & other react <-> angular sync
var BridgeSrv = /** @class */ (function () {
    /** @ngInject */
    function BridgeSrv($location, $timeout, $window, $rootScope, $route) {
        this.$location = $location;
        this.$timeout = $timeout;
        this.$window = $window;
        this.$rootScope = $rootScope;
        this.$route = $route;
        this.fullPageReloadRoutes = ['/logout'];
    }
    BridgeSrv.prototype.init = function () {
        var _this = this;
        this.$rootScope.$on('$routeUpdate', function (evt, data) {
            var angularUrl = _this.$location.url();
            var state = store.getState();
            if (state.location.url !== angularUrl) {
                store.dispatch(updateLocation({
                    path: _this.$location.path(),
                    query: _this.$location.search(),
                    routeParams: _this.$route.current.params,
                }));
            }
        });
        this.$rootScope.$on('$routeChangeSuccess', function (evt, data) {
            store.dispatch(updateLocation({
                path: _this.$location.path(),
                query: _this.$location.search(),
                routeParams: _this.$route.current.params,
            }));
        });
        // Listen for changes in redux location -> update angular location
        store.subscribe(function () {
            var state = store.getState();
            var angularUrl = _this.$location.url();
            var url = locationUtil.stripBaseFromUrl(state.location.url);
            if (angularUrl !== url) {
                _this.$timeout(function () {
                    _this.$location.url(url);
                    // some state changes should not trigger new browser history
                    if (state.location.replace) {
                        _this.$location.replace();
                    }
                });
                console.log('store updating angular $location.url', url);
            }
        });
        appEvents.on('location-change', function (payload) {
            var urlWithoutBase = locationUtil.stripBaseFromUrl(payload.href);
            if (_this.fullPageReloadRoutes.indexOf(urlWithoutBase) > -1) {
                _this.$window.location.href = payload.href;
                return;
            }
            _this.$timeout(function () {
                // A hack to use timeout when we're changing things (in this case the url) from outside of Angular.
                _this.$location.url(urlWithoutBase);
            });
        });
    };
    return BridgeSrv;
}());
export { BridgeSrv };
coreModule.service('bridgeSrv', BridgeSrv);
//# sourceMappingURL=bridge_srv.js.map