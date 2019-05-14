// Libraries
import _ from 'lodash';
// Utils
import { toUrlParams } from 'app/core/utils/url';
import coreModule from '../../core/core_module';
import appEvents from 'app/core/app_events';
import locationUtil from 'app/core/utils/location_util';
import kbn from 'app/core/utils/kbn';
import { store } from 'app/store/store';
var PlaylistSrv = /** @class */ (function () {
    /** @ngInject */
    function PlaylistSrv($location, $timeout, backendSrv) {
        this.$location = $location;
        this.$timeout = $timeout;
        this.backendSrv = backendSrv;
        this.numberOfLoops = 0;
    }
    PlaylistSrv.prototype.next = function () {
        var _this = this;
        this.$timeout.cancel(this.cancelPromise);
        var playedAllDashboards = this.index > this.dashboards.length - 1;
        if (playedAllDashboards) {
            this.numberOfLoops++;
            // This does full reload of the playlist to keep memory in check due to existing leaks but at the same time
            // we do not want page to flicker after each full loop.
            if (this.numberOfLoops >= 3) {
                window.location.href = this.startUrl;
                return;
            }
            this.index = 0;
        }
        var dash = this.dashboards[this.index];
        var queryParams = this.$location.search();
        var filteredParams = _.pickBy(queryParams, function (value) { return value !== null; });
        var nextDashboardUrl = locationUtil.stripBaseFromUrl(dash.url);
        // this is done inside timeout to make sure digest happens after
        // as this can be called from react
        this.$timeout(function () {
            _this.$location.url(nextDashboardUrl + '?' + toUrlParams(filteredParams));
        });
        this.index++;
        this.validPlaylistUrl = nextDashboardUrl;
        this.cancelPromise = this.$timeout(function () { return _this.next(); }, this.interval);
    };
    PlaylistSrv.prototype.prev = function () {
        this.index = Math.max(this.index - 2, 0);
        this.next();
    };
    // Detect url changes not caused by playlist srv and stop playlist
    PlaylistSrv.prototype.storeUpdated = function () {
        var state = store.getState();
        if (state.location.path !== this.validPlaylistUrl) {
            this.stop();
        }
    };
    PlaylistSrv.prototype.start = function (playlistId) {
        var _this = this;
        this.stop();
        this.startUrl = window.location.href;
        this.index = 0;
        this.isPlaying = true;
        // setup location tracking
        this.storeUnsub = store.subscribe(function () { return _this.storeUpdated(); });
        this.validPlaylistUrl = this.$location.path();
        appEvents.emit('playlist-started');
        return this.backendSrv.get("/api/playlists/" + playlistId).then(function (playlist) {
            return _this.backendSrv.get("/api/playlists/" + playlistId + "/dashboards").then(function (dashboards) {
                _this.dashboards = dashboards;
                _this.interval = kbn.interval_to_ms(playlist.interval);
                _this.next();
            });
        });
    };
    PlaylistSrv.prototype.stop = function () {
        if (this.isPlaying) {
            var queryParams = this.$location.search();
            if (queryParams.kiosk) {
                appEvents.emit('toggle-kiosk-mode', { exit: true });
            }
        }
        this.index = 0;
        this.isPlaying = false;
        if (this.storeUnsub) {
            this.storeUnsub();
        }
        if (this.cancelPromise) {
            this.$timeout.cancel(this.cancelPromise);
        }
        appEvents.emit('playlist-stopped');
    };
    return PlaylistSrv;
}());
export { PlaylistSrv };
coreModule.service('playlistSrv', PlaylistSrv);
//# sourceMappingURL=playlist_srv.js.map