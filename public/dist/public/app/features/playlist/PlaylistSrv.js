// Libraries
import { pickBy } from 'lodash';
// Utils
import { getBackendSrv, locationService } from '@grafana/runtime';
import { locationUtil, urlUtil, rangeUtil } from '@grafana/data';
export var queryParamsToPreserve = {
    kiosk: true,
    autofitpanels: true,
    orgId: true,
};
var PlaylistSrv = /** @class */ (function () {
    function PlaylistSrv() {
        this.index = 0;
        this.numberOfLoops = 0;
        this.isPlaying = false;
        this.locationUpdated = this.locationUpdated.bind(this);
    }
    PlaylistSrv.prototype.next = function () {
        var _this = this;
        clearTimeout(this.nextTimeoutId);
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
        var queryParams = locationService.getSearchObject();
        var filteredParams = pickBy(queryParams, function (value, key) { return queryParamsToPreserve[key]; });
        var nextDashboardUrl = locationUtil.stripBaseFromUrl(dash.url);
        this.index++;
        this.validPlaylistUrl = nextDashboardUrl;
        this.nextTimeoutId = setTimeout(function () { return _this.next(); }, this.interval);
        locationService.push(nextDashboardUrl + '?' + urlUtil.toUrlParams(filteredParams));
    };
    PlaylistSrv.prototype.prev = function () {
        this.index = Math.max(this.index - 2, 0);
        this.next();
    };
    // Detect url changes not caused by playlist srv and stop playlist
    PlaylistSrv.prototype.locationUpdated = function (location) {
        if (location.pathname !== this.validPlaylistUrl) {
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
        this.locationListenerUnsub = locationService.getHistory().listen(this.locationUpdated);
        return getBackendSrv()
            .get("/api/playlists/" + playlistId)
            .then(function (playlist) {
            return getBackendSrv()
                .get("/api/playlists/" + playlistId + "/dashboards")
                .then(function (dashboards) {
                _this.dashboards = dashboards;
                _this.interval = rangeUtil.intervalToMs(playlist.interval);
                _this.next();
            });
        });
    };
    PlaylistSrv.prototype.stop = function () {
        if (!this.isPlaying) {
            return;
        }
        this.index = 0;
        this.isPlaying = false;
        if (this.locationListenerUnsub) {
            this.locationListenerUnsub();
        }
        if (this.nextTimeoutId) {
            clearTimeout(this.nextTimeoutId);
        }
        if (locationService.getSearchObject().kiosk) {
            locationService.partial({ kiosk: null });
        }
    };
    return PlaylistSrv;
}());
export { PlaylistSrv };
export var playlistSrv = new PlaylistSrv();
//# sourceMappingURL=PlaylistSrv.js.map