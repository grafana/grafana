import { __awaiter } from "tslib";
import { pickBy } from 'lodash';
import { locationUtil, urlUtil, rangeUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { getPlaylistAPI, loadDashboards } from './api';
export const queryParamsToPreserve = {
    kiosk: true,
    autofitpanels: true,
    orgId: true,
};
export class PlaylistSrv {
    constructor() {
        this.urls = []; // the URLs we need to load
        this.index = 0;
        this.numberOfLoops = 0;
        this.isPlaying = false;
        this.locationUpdated = this.locationUpdated.bind(this);
        this.api = getPlaylistAPI();
    }
    next() {
        clearTimeout(this.nextTimeoutId);
        const playedAllDashboards = this.index > this.urls.length - 1;
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
        const url = this.urls[this.index];
        const queryParams = locationService.getSearchObject();
        const filteredParams = pickBy(queryParams, (value, key) => queryParamsToPreserve[key]);
        const nextDashboardUrl = locationUtil.stripBaseFromUrl(url);
        this.index++;
        this.validPlaylistUrl = nextDashboardUrl;
        this.nextTimeoutId = setTimeout(() => this.next(), this.interval);
        locationService.push(nextDashboardUrl + '?' + urlUtil.toUrlParams(filteredParams));
    }
    prev() {
        this.index = Math.max(this.index - 2, 0);
        this.next();
    }
    // Detect url changes not caused by playlist srv and stop playlist
    locationUpdated(location) {
        if (location.pathname !== this.validPlaylistUrl) {
            this.stop();
        }
    }
    start(playlistUid) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            this.stop();
            this.startUrl = window.location.href;
            this.index = 0;
            this.isPlaying = true;
            // setup location tracking
            this.locationListenerUnsub = locationService.getHistory().listen(this.locationUpdated);
            const urls = [];
            let playlist = yield this.api.getPlaylist(playlistUid);
            if (!((_a = playlist.items) === null || _a === void 0 ? void 0 : _a.length)) {
                // alert
                return;
            }
            this.interval = rangeUtil.intervalToMs(playlist.interval);
            const items = yield loadDashboards(playlist.items);
            for (const item of items) {
                if (item.dashboards) {
                    for (const dash of item.dashboards) {
                        urls.push(dash.url);
                    }
                }
            }
            if (!urls.length) {
                // alert... not found, etc
                return;
            }
            this.urls = urls;
            this.isPlaying = true;
            this.next();
            return;
        });
    }
    stop() {
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
    }
}
export const playlistSrv = new PlaylistSrv();
//# sourceMappingURL=PlaylistSrv.js.map