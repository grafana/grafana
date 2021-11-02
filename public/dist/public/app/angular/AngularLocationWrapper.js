import { __assign, __values } from "tslib";
import { locationSearchToObject, locationService, navigationLogger } from '@grafana/runtime';
import { deprecationWarning, urlUtil } from '@grafana/data';
// Ref: https://github.com/angular/angular.js/blob/ae8e903edf88a83fedd116ae02c0628bf72b150c/src/ng/location.js#L5
var DEFAULT_PORTS = { http: 80, https: 443, ftp: 21 };
var AngularLocationWrapper = /** @class */ (function () {
    function AngularLocationWrapper() {
        this.absUrl = this.wrapInDeprecationWarning(this.absUrl);
        this.hash = this.wrapInDeprecationWarning(this.hash);
        this.host = this.wrapInDeprecationWarning(this.host);
        this.path = this.wrapInDeprecationWarning(this.path);
        this.port = this.wrapInDeprecationWarning(this.port, 'window.location');
        this.protocol = this.wrapInDeprecationWarning(this.protocol, 'window.location');
        this.replace = this.wrapInDeprecationWarning(this.replace);
        this.search = this.wrapInDeprecationWarning(this.search);
        this.state = this.wrapInDeprecationWarning(this.state);
        this.url = this.wrapInDeprecationWarning(this.url);
    }
    AngularLocationWrapper.prototype.wrapInDeprecationWarning = function (fn, replacement) {
        var self = this;
        return function wrapper() {
            deprecationWarning('$location', fn.name, replacement || 'locationService');
            return fn.apply(self, arguments);
        };
    };
    AngularLocationWrapper.prototype.absUrl = function () {
        return "" + window.location.origin + this.url();
    };
    AngularLocationWrapper.prototype.hash = function (newHash) {
        navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: hash');
        if (!newHash) {
            return locationService.getLocation().hash.substr(1);
        }
        else {
            throw new Error('AngularLocationWrapper method not implemented.');
        }
    };
    AngularLocationWrapper.prototype.host = function () {
        return new URL(window.location.href).hostname;
    };
    AngularLocationWrapper.prototype.path = function (pathname) {
        navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: path');
        var location = locationService.getLocation();
        if (pathname !== undefined && pathname !== null) {
            var parsedPath = String(pathname);
            parsedPath = parsedPath.startsWith('/') ? parsedPath : "/" + parsedPath;
            var url = new URL("" + window.location.origin + parsedPath);
            locationService.push({
                pathname: url.pathname,
                search: url.search.length > 0 ? url.search : location.search,
                hash: url.hash.length > 0 ? url.hash : location.hash,
            });
            return this;
        }
        if (pathname === null) {
            locationService.push('/');
            return this;
        }
        return location.pathname;
    };
    AngularLocationWrapper.prototype.port = function () {
        var url = new URL(window.location.href);
        return parseInt(url.port, 10) || DEFAULT_PORTS[url.protocol] || null;
    };
    AngularLocationWrapper.prototype.protocol = function () {
        return new URL(window.location.href).protocol.slice(0, -1);
    };
    AngularLocationWrapper.prototype.replace = function () {
        throw new Error('AngularLocationWrapper method not implemented.');
    };
    AngularLocationWrapper.prototype.search = function (search, paramValue) {
        var _a, e_1, _b;
        navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: search');
        if (!search) {
            return locationService.getSearchObject();
        }
        if (search && arguments.length > 1) {
            locationService.partial((_a = {},
                _a[search] = paramValue,
                _a));
            return this;
        }
        if (search) {
            var newQuery = void 0;
            if (typeof search === 'object') {
                newQuery = __assign({}, search);
            }
            else {
                newQuery = locationSearchToObject(search);
            }
            try {
                for (var _c = __values(Object.keys(newQuery)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var key = _d.value;
                    // removing params with null | undefined
                    if (newQuery[key] === null || newQuery[key] === undefined) {
                        delete newQuery[key];
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            var updatedUrl = urlUtil.renderUrl(locationService.getLocation().pathname, newQuery);
            locationService.push(updatedUrl);
        }
        return this;
    };
    AngularLocationWrapper.prototype.state = function (state) {
        navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: state');
        throw new Error('AngularLocationWrapper method not implemented.');
    };
    AngularLocationWrapper.prototype.url = function (newUrl) {
        navigationLogger('AngularLocationWrapper', false, 'Angular compat layer: url');
        if (newUrl !== undefined) {
            if (newUrl.startsWith('#')) {
                locationService.push(__assign(__assign({}, locationService.getLocation()), { hash: newUrl }));
            }
            else if (newUrl.startsWith('?')) {
                locationService.push(__assign(__assign({}, locationService.getLocation()), { search: newUrl }));
            }
            else if (newUrl.trim().length === 0) {
                locationService.push('/');
            }
            else {
                locationService.push(newUrl);
            }
            return locationService;
        }
        var location = locationService.getLocation();
        return "" + location.pathname + location.search + location.hash;
    };
    return AngularLocationWrapper;
}());
export { AngularLocationWrapper };
//# sourceMappingURL=AngularLocationWrapper.js.map