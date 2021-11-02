import { getConfig } from 'app/core/config';
export var getForcedLoginUrl = function (url) {
    var queryParams = new URLSearchParams(url.split('?')[1]);
    queryParams.append('forceLogin', 'true');
    return "" + getConfig().appSubUrl + url.split('?')[0] + "?" + queryParams.toString();
};
export var isLinkActive = function (pathname, link) {
    var _a, _b;
    // strip out any query params
    var linkPathname = (_a = link.url) === null || _a === void 0 ? void 0 : _a.split('?')[0];
    if (linkPathname) {
        if (linkPathname === pathname) {
            // exact match
            return true;
        }
        else if (linkPathname !== '/' && pathname.startsWith(linkPathname)) {
            // partial match
            return true;
        }
        else if (linkPathname === '/alerting/list' && pathname.startsWith('/alerting/notification/')) {
            // alert channel match
            // TODO refactor routes such that we don't need this custom logic
            return true;
        }
        else if (linkPathname === '/' && pathname.startsWith('/d/')) {
            // dashboard match
            // TODO refactor routes such that we don't need this custom logic
            return true;
        }
    }
    // child match
    if ((_b = link.children) === null || _b === void 0 ? void 0 : _b.some(function (childLink) { return isLinkActive(pathname, childLink); })) {
        return true;
    }
    return false;
};
export var isSearchActive = function (location) {
    var query = new URLSearchParams(location.search);
    return query.get('search') === 'open';
};
//# sourceMappingURL=utils.js.map