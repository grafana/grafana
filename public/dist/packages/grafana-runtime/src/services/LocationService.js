import { __assign, __values } from "tslib";
import { deprecationWarning, urlUtil } from '@grafana/data';
import * as H from 'history';
import { attachDebugger, createLogger } from '@grafana/ui';
import { config } from '../config';
/** @internal */
var HistoryWrapper = /** @class */ (function () {
    function HistoryWrapper(history) {
        var _a;
        // If no history passed create an in memory one if being called from test
        this.history =
            history ||
                (process.env.NODE_ENV === 'test'
                    ? H.createMemoryHistory({ initialEntries: ['/'] })
                    : H.createBrowserHistory({ basename: (_a = config.appSubUrl) !== null && _a !== void 0 ? _a : '/' }));
        this.partial = this.partial.bind(this);
        this.push = this.push.bind(this);
        this.replace = this.replace.bind(this);
        this.getSearch = this.getSearch.bind(this);
        this.getHistory = this.getHistory.bind(this);
        this.getLocation = this.getLocation.bind(this);
    }
    HistoryWrapper.prototype.getHistory = function () {
        return this.history;
    };
    HistoryWrapper.prototype.getSearch = function () {
        return new URLSearchParams(this.history.location.search);
    };
    HistoryWrapper.prototype.partial = function (query, replace) {
        var e_1, _a;
        var currentLocation = this.history.location;
        var newQuery = this.getSearchObject();
        try {
            for (var _b = __values(Object.keys(query)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                // removing params with null | undefined
                if (query[key] === null || query[key] === undefined) {
                    delete newQuery[key];
                }
                else {
                    newQuery[key] = query[key];
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var updatedUrl = urlUtil.renderUrl(currentLocation.pathname, newQuery);
        if (replace) {
            this.history.replace(updatedUrl, this.history.location.state);
        }
        else {
            this.history.push(updatedUrl, this.history.location.state);
        }
    };
    HistoryWrapper.prototype.push = function (location) {
        this.history.push(location);
    };
    HistoryWrapper.prototype.replace = function (location) {
        this.history.replace(location);
    };
    HistoryWrapper.prototype.reload = function () {
        var _a;
        var prevState = (_a = this.history.location.state) === null || _a === void 0 ? void 0 : _a.routeReloadCounter;
        this.history.replace(__assign(__assign({}, this.history.location), { state: { routeReloadCounter: prevState ? prevState + 1 : 1 } }));
    };
    HistoryWrapper.prototype.getLocation = function () {
        return this.history.location;
    };
    HistoryWrapper.prototype.getSearchObject = function () {
        return locationSearchToObject(this.history.location.search);
    };
    /** @deprecated use partial, push or replace instead */
    HistoryWrapper.prototype.update = function (options) {
        deprecationWarning('LocationSrv', 'update', 'partial, push or replace');
        if (options.partial && options.query) {
            this.partial(options.query, options.partial);
        }
        else {
            var newLocation = {
                pathname: options.path,
            };
            if (options.query) {
                newLocation.search = urlUtil.toUrlParams(options.query);
            }
            if (options.replace) {
                this.replace(newLocation);
            }
            else {
                this.push(newLocation);
            }
        }
    };
    return HistoryWrapper;
}());
export { HistoryWrapper };
/**
 * @alpha
 * Parses a location search string to an object
 * */
export function locationSearchToObject(search) {
    var queryString = typeof search === 'number' ? String(search) : search;
    if (queryString.length > 0) {
        if (queryString.startsWith('?')) {
            return urlUtil.parseKeyValue(queryString.substring(1));
        }
        return urlUtil.parseKeyValue(queryString);
    }
    return {};
}
/**
 * @alpha
 */
export var locationService = new HistoryWrapper();
/** @internal
 * Used for tests only
 */
export var setLocationService = function (location) {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('locationService can be only overriden in test environment');
    }
    locationService = location;
};
var navigationLog = createLogger('Router');
/** @internal */
export var navigationLogger = navigationLog.logger;
// For debugging purposes the location service is attached to global _debug variable
attachDebugger('location', locationService, navigationLog);
//# sourceMappingURL=LocationService.js.map