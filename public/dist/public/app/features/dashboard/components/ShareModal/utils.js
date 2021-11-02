import { __awaiter, __generator } from "tslib";
import { config } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { createShortLink } from 'app/core/utils/shortLinks';
import { dateTime, urlUtil } from '@grafana/data';
export function buildParams(_a) {
    var useCurrentTimeRange = _a.useCurrentTimeRange, selectedTheme = _a.selectedTheme, panel = _a.panel, _b = _a.search, search = _b === void 0 ? window.location.search : _b, _c = _a.range, range = _c === void 0 ? getTimeSrv().timeRange() : _c, _d = _a.orgId, orgId = _d === void 0 ? config.bootData.user.orgId : _d;
    var searchParams = new URLSearchParams(search);
    searchParams.set('from', String(range.from.valueOf()));
    searchParams.set('to', String(range.to.valueOf()));
    searchParams.set('orgId', orgId);
    if (!useCurrentTimeRange) {
        searchParams.delete('from');
        searchParams.delete('to');
    }
    if (selectedTheme !== 'current') {
        searchParams.set('theme', selectedTheme);
    }
    if (panel && !searchParams.has('editPanel')) {
        searchParams.set('viewPanel', String(panel.id));
    }
    return searchParams;
}
export function buildBaseUrl() {
    var baseUrl = window.location.href;
    var queryStart = baseUrl.indexOf('?');
    if (queryStart !== -1) {
        baseUrl = baseUrl.substring(0, queryStart);
    }
    return baseUrl;
}
export function buildShareUrl(useCurrentTimeRange, selectedTheme, panel, shortenUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var baseUrl, params, shareUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    baseUrl = buildBaseUrl();
                    params = buildParams({ useCurrentTimeRange: useCurrentTimeRange, selectedTheme: selectedTheme, panel: panel });
                    shareUrl = urlUtil.appendQueryToUrl(baseUrl, params.toString());
                    if (!shortenUrl) return [3 /*break*/, 2];
                    return [4 /*yield*/, createShortLink(shareUrl)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2: return [2 /*return*/, shareUrl];
            }
        });
    });
}
export function buildSoloUrl(useCurrentTimeRange, selectedTheme, panel) {
    var _a, _b;
    var baseUrl = buildBaseUrl();
    var params = buildParams({ useCurrentTimeRange: useCurrentTimeRange, selectedTheme: selectedTheme, panel: panel });
    var soloUrl = baseUrl.replace(config.appSubUrl + '/dashboard/', config.appSubUrl + '/dashboard-solo/');
    soloUrl = soloUrl.replace(config.appSubUrl + '/d/', config.appSubUrl + '/d-solo/');
    var panelId = (_b = (_a = params.get('editPanel')) !== null && _a !== void 0 ? _a : params.get('viewPanel')) !== null && _b !== void 0 ? _b : '';
    params.set('panelId', panelId);
    params.delete('editPanel');
    params.delete('viewPanel');
    return urlUtil.appendQueryToUrl(soloUrl, params.toString());
}
export function buildImageUrl(useCurrentTimeRange, selectedTheme, panel) {
    var soloUrl = buildSoloUrl(useCurrentTimeRange, selectedTheme, panel);
    var imageUrl = soloUrl.replace(config.appSubUrl + '/dashboard-solo/', config.appSubUrl + '/render/dashboard-solo/');
    imageUrl = imageUrl.replace(config.appSubUrl + '/d-solo/', config.appSubUrl + '/render/d-solo/');
    imageUrl += '&width=1000&height=500' + getLocalTimeZone();
    return imageUrl;
}
export function buildIframeHtml(useCurrentTimeRange, selectedTheme, panel) {
    var soloUrl = buildSoloUrl(useCurrentTimeRange, selectedTheme, panel);
    return '<iframe src="' + soloUrl + '" width="450" height="200" frameborder="0"></iframe>';
}
export function getLocalTimeZone() {
    var utcOffset = '&tz=UTC' + encodeURIComponent(dateTime().format('Z'));
    // Older browser does not the internationalization API
    if (!window.Intl) {
        return utcOffset;
    }
    var dateFormat = window.Intl.DateTimeFormat();
    if (!dateFormat.resolvedOptions) {
        return utcOffset;
    }
    var options = dateFormat.resolvedOptions();
    if (!options.timeZone) {
        return utcOffset;
    }
    return '&tz=' + encodeURIComponent(options.timeZone);
}
//# sourceMappingURL=utils.js.map