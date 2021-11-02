import { urlUtil } from './url';
import { textUtil } from '../text';
var grafanaConfig = { appSubUrl: '' };
var getTimeRangeUrlParams;
var getVariablesUrlParams;
/**
 *
 * @param url
 * @internal
 */
var stripBaseFromUrl = function (url) {
    var _a;
    var appSubUrl = (_a = grafanaConfig.appSubUrl) !== null && _a !== void 0 ? _a : '';
    var stripExtraChars = appSubUrl.endsWith('/') ? 1 : 0;
    var isAbsoluteUrl = url.startsWith('http');
    var segmentToStrip = appSubUrl;
    if (!url.startsWith('/') || isAbsoluteUrl) {
        segmentToStrip = "" + window.location.origin + appSubUrl;
    }
    return url.length > 0 && url.indexOf(segmentToStrip) === 0 ? url.slice(segmentToStrip.length - stripExtraChars) : url;
};
/**
 *
 * @param url
 * @internal
 */
var assureBaseUrl = function (url) {
    if (url.startsWith('/')) {
        return "" + grafanaConfig.appSubUrl + stripBaseFromUrl(url);
    }
    return url;
};
var updateSearchParams = function (href, searchParams) {
    var curURL = new URL(href);
    var urlSearchParams = new URLSearchParams(searchParams);
    urlSearchParams.forEach(function (val, key) { return curURL.searchParams.set(key, val); });
    return curURL.href;
};
export var locationUtil = {
    /**
     *
     * @param getConfig
     * @param getAllVariableValuesForUrl
     * @param getTimeRangeForUrl
     * @internal
     */
    initialize: function (dependencies) {
        grafanaConfig = dependencies.config;
        getTimeRangeUrlParams = dependencies.getTimeRangeForUrl;
        getVariablesUrlParams = dependencies.getVariablesUrlParams;
    },
    stripBaseFromUrl: stripBaseFromUrl,
    assureBaseUrl: assureBaseUrl,
    updateSearchParams: updateSearchParams,
    getTimeRangeUrlParams: function () {
        if (!getTimeRangeUrlParams) {
            return null;
        }
        return urlUtil.toUrlParams(getTimeRangeUrlParams());
    },
    getVariablesUrlParams: function (scopedVars) {
        if (!getVariablesUrlParams) {
            return null;
        }
        var params = getVariablesUrlParams(scopedVars);
        return urlUtil.toUrlParams(params);
    },
    processUrl: function (url) {
        return grafanaConfig.disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);
    },
};
//# sourceMappingURL=location.js.map