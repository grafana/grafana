import { __assign } from "tslib";
import { Severity } from '@sentry/browser';
import { logger, parseRetryAfterHeader, PromiseBuffer, supportsReferrerPolicy, SyncPromise } from '@sentry/utils';
import { Status } from '@sentry/types';
var DEFAULT_MAX_CONCURRENT_REQUESTS = 3;
/**
 * This is a copy of sentry's FetchTransport, edited to be able to push to any custom url
 * instead of using Sentry-specific endpoint logic.
 * Also transforms some of the payload values to be parseable by go.
 * Sends events sequentially and implements back-off in case of rate limiting.
 */
var CustomEndpointTransport = /** @class */ (function () {
    function CustomEndpointTransport(options) {
        var _a;
        this.options = options;
        /** Locks transport after receiving 429 response */
        this._disabledUntil = new Date(Date.now());
        this._buffer = new PromiseBuffer((_a = options.maxConcurrentRequests) !== null && _a !== void 0 ? _a : DEFAULT_MAX_CONCURRENT_REQUESTS);
    }
    CustomEndpointTransport.prototype.sendEvent = function (event) {
        var _this = this;
        var _a, _b, _c;
        if (new Date(Date.now()) < this._disabledUntil) {
            var reason = "Dropping frontend event due to too many requests.";
            console.warn(reason);
            return Promise.resolve({
                event: event,
                reason: reason,
                status: Status.Skipped,
            });
        }
        var sentryReq = {
            // convert all timestamps to iso string, so it's parseable by backend
            body: JSON.stringify(__assign(__assign({}, event), { level: (_a = event.level) !== null && _a !== void 0 ? _a : (event.exception ? Severity.Error : Severity.Info), exception: event.exception
                    ? {
                        values: (_b = event.exception.values) === null || _b === void 0 ? void 0 : _b.map(function (value) { return (__assign(__assign({}, value), { 
                            // according to both typescript and go types, value is supposed to be string.
                            // but in some odd cases at runtime it turns out to be an empty object {}
                            // let's fix it here
                            value: fmtSentryErrorValue(value.value) })); }),
                    }
                    : event.exception, breadcrumbs: (_c = event.breadcrumbs) === null || _c === void 0 ? void 0 : _c.map(function (breadcrumb) { return (__assign(__assign({}, breadcrumb), { timestamp: makeTimestamp(breadcrumb.timestamp) })); }), timestamp: makeTimestamp(event.timestamp) })),
            url: this.options.endpoint,
        };
        var options = {
            body: sentryReq.body,
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
            // Despite all stars in the sky saying that Edge supports old draft syntax, aka 'never', 'always', 'origin' and 'default
            // https://caniuse.com/#feat=referrer-policy
            // It doesn't. And it throw exception instead of ignoring this parameter...
            // REF: https://github.com/getsentry/raven-js/issues/1233
            referrerPolicy: (supportsReferrerPolicy() ? 'origin' : ''),
        };
        if (this.options.fetchParameters !== undefined) {
            Object.assign(options, this.options.fetchParameters);
        }
        if (!this._buffer.isReady()) {
            var reason = "Dropping frontend log event due to too many requests in flight.";
            console.warn(reason);
            return Promise.resolve({
                event: event,
                reason: reason,
                status: Status.Skipped,
            });
        }
        return this._buffer.add(function () {
            return new SyncPromise(function (resolve, reject) {
                window
                    .fetch(sentryReq.url, options)
                    .then(function (response) {
                    var status = Status.fromHttpCode(response.status);
                    if (status === Status.Success) {
                        resolve({ status: status });
                        return;
                    }
                    if (status === Status.RateLimit) {
                        var now = Date.now();
                        var retryAfterHeader = response.headers.get('Retry-After');
                        _this._disabledUntil = new Date(now + parseRetryAfterHeader(now, retryAfterHeader));
                        logger.warn("Too many requests, backing off till: " + _this._disabledUntil);
                    }
                    reject(response);
                })
                    .catch(reject);
            });
        });
    };
    return CustomEndpointTransport;
}());
export { CustomEndpointTransport };
function makeTimestamp(time) {
    if (time) {
        return new Date(time * 1000).toISOString();
    }
    return new Date().toISOString();
}
function fmtSentryErrorValue(value) {
    if (typeof value === 'string' || value === undefined) {
        return value;
    }
    else if (value && typeof value === 'object' && Object.keys(value).length === 0) {
        return '';
    }
    return String(value);
}
//# sourceMappingURL=CustomEndpointTransport.js.map