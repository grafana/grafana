import { __awaiter } from "tslib";
import { dateTime, locationUtil, urlUtil, rangeUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { createShortLink } from 'app/core/utils/shortLinks';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
export function buildParams({ useCurrentTimeRange, selectedTheme, panel, search = window.location.search, range = getTimeSrv().timeRange(), orgId = config.bootData.user.orgId, }) {
    const searchParams = new URLSearchParams(search);
    const relative = panel === null || panel === void 0 ? void 0 : panel.timeFrom;
    // Use panel's relative time if it's set
    if (relative) {
        const { from, to } = rangeUtil.describeTextRange(relative);
        searchParams.set('from', from);
        searchParams.set('to', to);
    }
    else {
        searchParams.set('from', String(range.from.valueOf()));
        searchParams.set('to', String(range.to.valueOf()));
    }
    searchParams.set('orgId', String(orgId));
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
    let baseUrl = window.location.href;
    const queryStart = baseUrl.indexOf('?');
    if (queryStart !== -1) {
        baseUrl = baseUrl.substring(0, queryStart);
    }
    return baseUrl;
}
export function buildShareUrl(useCurrentTimeRange, selectedTheme, panel, shortenUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const baseUrl = buildBaseUrl();
        const params = buildParams({ useCurrentTimeRange, selectedTheme, panel });
        const shareUrl = urlUtil.appendQueryToUrl(baseUrl, params.toString());
        if (shortenUrl) {
            return yield createShortLink(shareUrl);
        }
        return shareUrl;
    });
}
export function buildSoloUrl(useCurrentTimeRange, dashboardUid, selectedTheme, panel) {
    var _a, _b;
    const baseUrl = buildBaseUrl();
    const params = buildParams({ useCurrentTimeRange, selectedTheme, panel });
    let soloUrl = baseUrl.replace(config.appSubUrl + '/dashboard/', config.appSubUrl + '/dashboard-solo/');
    soloUrl = soloUrl.replace(config.appSubUrl + '/d/', config.appSubUrl + '/d-solo/');
    // For handling the case when default_home_dashboard_path is set in the grafana config
    const strippedUrl = locationUtil.stripBaseFromUrl(baseUrl);
    if (strippedUrl === '/') {
        soloUrl = `${config.appUrl}d-solo/${dashboardUid}`;
    }
    const panelId = (_b = (_a = params.get('editPanel')) !== null && _a !== void 0 ? _a : params.get('viewPanel')) !== null && _b !== void 0 ? _b : '';
    params.set('panelId', panelId);
    params.delete('editPanel');
    params.delete('viewPanel');
    return urlUtil.appendQueryToUrl(soloUrl, params.toString());
}
export function buildImageUrl(useCurrentTimeRange, dashboardUid, selectedTheme, panel) {
    let soloUrl = buildSoloUrl(useCurrentTimeRange, dashboardUid, selectedTheme, panel);
    let imageUrl = soloUrl.replace(config.appSubUrl + '/dashboard-solo/', config.appSubUrl + '/render/dashboard-solo/');
    imageUrl = imageUrl.replace(config.appSubUrl + '/d-solo/', config.appSubUrl + '/render/d-solo/');
    imageUrl += '&width=1000&height=500' + getLocalTimeZone();
    return imageUrl;
}
export function buildIframeHtml(useCurrentTimeRange, dashboardUid, selectedTheme, panel) {
    let soloUrl = buildSoloUrl(useCurrentTimeRange, dashboardUid, selectedTheme, panel);
    return '<iframe src="' + soloUrl + '" width="450" height="200" frameborder="0"></iframe>';
}
export function getLocalTimeZone() {
    const utcOffset = '&tz=UTC' + encodeURIComponent(dateTime().format('Z'));
    // Older browser does not the internationalization API
    if (!window.Intl) {
        return utcOffset;
    }
    const dateFormat = window.Intl.DateTimeFormat();
    if (!dateFormat.resolvedOptions) {
        return utcOffset;
    }
    const options = dateFormat.resolvedOptions();
    if (!options.timeZone) {
        return utcOffset;
    }
    return '&tz=' + encodeURIComponent(options.timeZone);
}
export const shareDashboardType = {
    link: 'link',
    snapshot: 'snapshot',
    export: 'export',
    embed: 'embed',
    libraryPanel: 'library_panel',
    pdf: 'pdf',
    report: 'report',
    publicDashboard: 'public_dashboard',
};
//# sourceMappingURL=utils.js.map