import { __assign, __awaiter, __generator } from "tslib";
import { from, lastValueFrom, merge, Observable, of, Subject, Subscription, throwError, } from 'rxjs';
import { catchError, filter, map, mergeMap, retryWhen, share, takeUntil, tap, throwIfEmpty } from 'rxjs/operators';
import { fromFetch } from 'rxjs/fetch';
import { v4 as uuidv4 } from 'uuid';
import { AppEvents, DataQueryErrorType } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { getConfig } from 'app/core/config';
import { coreModule } from 'app/core/core_module';
import { contextSrv } from './context_srv';
import { parseInitFromOptions, parseResponseBody, parseUrlFromOptions } from '../utils/fetch';
import { isDataQuery, isLocalUrl } from '../utils/query';
import { FetchQueue } from './FetchQueue';
import { ResponseQueue } from './ResponseQueue';
import { FetchQueueWorker } from './FetchQueueWorker';
import { TokenRevokedModal } from 'app/features/users/TokenRevokedModal';
import { ShowModalReactEvent } from '../../types/events';
var CANCEL_ALL_REQUESTS_REQUEST_ID = 'cancel_all_requests_request_id';
var BackendSrv = /** @class */ (function () {
    function BackendSrv(deps) {
        this.inFlightRequests = new Subject();
        this.HTTP_REQUEST_CANCELED = -1;
        this.inspectorStream = new Subject();
        this.dependencies = {
            fromFetch: fromFetch,
            appEvents: appEvents,
            contextSrv: contextSrv,
            logout: function () {
                contextSrv.setLoggedOut();
                window.location.reload();
            },
        };
        if (deps) {
            this.dependencies = __assign(__assign({}, this.dependencies), deps);
        }
        this.noBackendCache = false;
        this.internalFetch = this.internalFetch.bind(this);
        this.fetchQueue = new FetchQueue();
        this.responseQueue = new ResponseQueue(this.fetchQueue, this.internalFetch);
        new FetchQueueWorker(this.fetchQueue, this.responseQueue, getConfig());
    }
    BackendSrv.prototype.request = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lastValueFrom(this.fetch(options).pipe(map(function (response) { return response.data; })))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BackendSrv.prototype.fetch = function (options) {
        var _this = this;
        // We need to match an entry added to the queue stream with the entry that is eventually added to the response stream
        var id = uuidv4();
        var fetchQueue = this.fetchQueue;
        return new Observable(function (observer) {
            // Subscription is an object that is returned whenever you subscribe to an Observable.
            // You can also use it as a container of many subscriptions and when it is unsubscribed all subscriptions within are also unsubscribed.
            var subscriptions = new Subscription();
            // We're using the subscriptions.add function to add the subscription implicitly returned by this.responseQueue.getResponses<T>(id).subscribe below.
            subscriptions.add(_this.responseQueue.getResponses(id).subscribe(function (result) {
                // The one liner below can seem magical if you're not accustomed to RxJs.
                // Firstly, we're subscribing to the result from the result.observable and we're passing in the outer observer object.
                // By passing the outer observer object then any updates on result.observable are passed through to any subscriber of the fetch<T> function.
                // Secondly, we're adding the subscription implicitly returned by result.observable.subscribe(observer).
                subscriptions.add(result.observable.subscribe(observer));
            }));
            // Let the fetchQueue know that this id needs to start data fetching.
            _this.fetchQueue.add(id, options);
            // This returned function will be called whenever the returned Observable from the fetch<T> function is unsubscribed/errored/completed/canceled.
            return function unsubscribe() {
                // Change status to Done moved here from ResponseQueue because this unsubscribe was called before the responseQueue produced a result
                fetchQueue.setDone(id);
                // When subscriptions is unsubscribed all the implicitly added subscriptions above are also unsubscribed.
                subscriptions.unsubscribe();
            };
        });
    };
    BackendSrv.prototype.internalFetch = function (options) {
        var _this = this;
        if (options.requestId) {
            this.inFlightRequests.next(options.requestId);
        }
        options = this.parseRequestOptions(options);
        var fromFetchStream = this.getFromFetchStream(options);
        var failureStream = fromFetchStream.pipe(this.toFailureStream(options));
        var successStream = fromFetchStream.pipe(filter(function (response) { return response.ok === true; }), tap(function (response) {
            _this.showSuccessAlert(response);
            _this.inspectorStream.next(response);
        }));
        return merge(successStream, failureStream).pipe(catchError(function (err) { return throwError(_this.processRequestError(options, err)); }), this.handleStreamCancellation(options));
    };
    BackendSrv.prototype.resolveCancelerIfExists = function (requestId) {
        this.inFlightRequests.next(requestId);
    };
    BackendSrv.prototype.cancelAllInFlightRequests = function () {
        this.inFlightRequests.next(CANCEL_ALL_REQUESTS_REQUEST_ID);
    };
    BackendSrv.prototype.datasourceRequest = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, lastValueFrom(this.fetch(options))];
            });
        });
    };
    BackendSrv.prototype.parseRequestOptions = function (options) {
        var _a, _b, _c, _d, _e;
        var orgId = (_a = this.dependencies.contextSrv.user) === null || _a === void 0 ? void 0 : _a.orgId;
        // init retry counter
        options.retry = (_b = options.retry) !== null && _b !== void 0 ? _b : 0;
        if (isLocalUrl(options.url)) {
            if (orgId) {
                options.headers = (_c = options.headers) !== null && _c !== void 0 ? _c : {};
                options.headers['X-Grafana-Org-Id'] = orgId;
            }
            if (options.url.startsWith('/')) {
                options.url = options.url.substring(1);
            }
            if ((_d = options.headers) === null || _d === void 0 ? void 0 : _d.Authorization) {
                options.headers['X-DS-Authorization'] = options.headers.Authorization;
                delete options.headers.Authorization;
            }
            if (this.noBackendCache) {
                options.headers = (_e = options.headers) !== null && _e !== void 0 ? _e : {};
                options.headers['X-Grafana-NoCache'] = 'true';
            }
        }
        if (options.hideFromInspector === undefined) {
            // Hide all local non data query calls
            options.hideFromInspector = isLocalUrl(options.url) && !isDataQuery(options.url);
        }
        return options;
    };
    BackendSrv.prototype.getFromFetchStream = function (options) {
        var _this = this;
        var url = parseUrlFromOptions(options);
        var init = parseInitFromOptions(options);
        return this.dependencies.fromFetch(url, init).pipe(mergeMap(function (response) { return __awaiter(_this, void 0, void 0, function () {
            var status, statusText, ok, headers, url, type, redirected, data, fetchResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        status = response.status, statusText = response.statusText, ok = response.ok, headers = response.headers, url = response.url, type = response.type, redirected = response.redirected;
                        return [4 /*yield*/, parseResponseBody(response, options.responseType)];
                    case 1:
                        data = _a.sent();
                        fetchResponse = {
                            status: status,
                            statusText: statusText,
                            ok: ok,
                            data: data,
                            headers: headers,
                            url: url,
                            type: type,
                            redirected: redirected,
                            config: options,
                        };
                        return [2 /*return*/, fetchResponse];
                }
            });
        }); }), share() // sharing this so we can split into success and failure and then merge back
        );
    };
    BackendSrv.prototype.toFailureStream = function (options) {
        var _this = this;
        var isSignedIn = this.dependencies.contextSrv.user.isSignedIn;
        return function (inputStream) {
            return inputStream.pipe(filter(function (response) { return response.ok === false; }), mergeMap(function (response) {
                var status = response.status, statusText = response.statusText, data = response.data;
                var fetchErrorResponse = { status: status, statusText: statusText, data: data, config: options };
                return throwError(fetchErrorResponse);
            }), retryWhen(function (attempts) {
                return attempts.pipe(mergeMap(function (error, i) {
                    var _a, _b, _c, _d;
                    var firstAttempt = i === 0 && options.retry === 0;
                    if (error.status === 401 && isLocalUrl(options.url) && firstAttempt && isSignedIn) {
                        if (((_b = (_a = error.data) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.id) === 'ERR_TOKEN_REVOKED') {
                            _this.dependencies.appEvents.publish(new ShowModalReactEvent({
                                component: TokenRevokedModal,
                                props: {
                                    maxConcurrentSessions: (_d = (_c = error.data) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.maxConcurrentSessions,
                                },
                            }));
                            return of({});
                        }
                        return from(_this.loginPing()).pipe(catchError(function (err) {
                            if (err.status === 401) {
                                _this.dependencies.logout();
                                return throwError(err);
                            }
                            return throwError(err);
                        }));
                    }
                    return throwError(error);
                }));
            }));
        };
    };
    BackendSrv.prototype.showApplicationErrorAlert = function (err) { };
    BackendSrv.prototype.showSuccessAlert = function (response) {
        var config = response.config;
        if (config.showSuccessAlert === false) {
            return;
        }
        // is showSuccessAlert is undefined we only show alerts non GET request, non data query and local api requests
        if (config.showSuccessAlert === undefined &&
            (config.method === 'GET' || isDataQuery(config.url) || !isLocalUrl(config.url))) {
            return;
        }
        var data = response.data;
        if (data === null || data === void 0 ? void 0 : data.message) {
            this.dependencies.appEvents.emit(AppEvents.alertSuccess, [data.message]);
        }
    };
    BackendSrv.prototype.showErrorAlert = function (config, err) {
        if (config.showErrorAlert === false) {
            return;
        }
        // is showErrorAlert is undefined we only show alerts non data query and local api requests
        if (config.showErrorAlert === undefined && (isDataQuery(config.url) || !isLocalUrl(config.url))) {
            return;
        }
        var description = '';
        var message = err.data.message;
        if (message.length > 80) {
            description = message;
            message = 'Error';
        }
        // Validation
        if (err.status === 422) {
            message = 'Validation failed';
        }
        this.dependencies.appEvents.emit(err.status < 500 ? AppEvents.alertWarning : AppEvents.alertError, [
            message,
            description,
        ]);
    };
    /**
     * Processes FetchError to ensure "data" property is an object.
     *
     * @see DataQueryError.data
     */
    BackendSrv.prototype.processRequestError = function (options, err) {
        var _this = this;
        var _a;
        err.data = (_a = err.data) !== null && _a !== void 0 ? _a : { message: 'Unexpected error' };
        if (typeof err.data === 'string') {
            err.data = {
                message: err.data,
                error: err.statusText,
                response: err.data,
            };
        }
        // If no message but got error string, copy to message prop
        if (err.data && !err.data.message && typeof err.data.error === 'string') {
            err.data.message = err.data.error;
        }
        // check if we should show an error alert
        if (err.data.message) {
            setTimeout(function () {
                if (!err.isHandled) {
                    _this.showErrorAlert(options, err);
                }
            }, 50);
        }
        this.inspectorStream.next(err);
        return err;
    };
    BackendSrv.prototype.handleStreamCancellation = function (options) {
        var _this = this;
        return function (inputStream) {
            return inputStream.pipe(takeUntil(_this.inFlightRequests.pipe(filter(function (requestId) {
                var cancelRequest = false;
                if (options && options.requestId && options.requestId === requestId) {
                    // when a new requestId is started it will be published to inFlightRequests
                    // if a previous long running request that hasn't finished yet has the same requestId
                    // we need to cancel that request
                    cancelRequest = true;
                }
                if (requestId === CANCEL_ALL_REQUESTS_REQUEST_ID) {
                    cancelRequest = true;
                }
                return cancelRequest;
            }))), 
            // when a request is cancelled by takeUntil it will complete without emitting anything so we use throwIfEmpty to identify this case
            // in throwIfEmpty we'll then throw an cancelled error and then we'll return the correct result in the catchError or rethrow
            throwIfEmpty(function () { return ({
                type: DataQueryErrorType.Cancelled,
                cancelled: true,
                data: null,
                status: _this.HTTP_REQUEST_CANCELED,
                statusText: 'Request was aborted',
                config: options,
            }); }));
        };
    };
    BackendSrv.prototype.getInspectorStream = function () {
        return this.inspectorStream;
    };
    BackendSrv.prototype.get = function (url, params, requestId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request({ method: 'GET', url: url, params: params, requestId: requestId })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BackendSrv.prototype.delete = function (url, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request({ method: 'DELETE', url: url, data: data })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BackendSrv.prototype.post = function (url, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request({ method: 'POST', url: url, data: data })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BackendSrv.prototype.patch = function (url, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request({ method: 'PATCH', url: url, data: data })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BackendSrv.prototype.put = function (url, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request({ method: 'PUT', url: url, data: data })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BackendSrv.prototype.withNoBackendCache = function (callback) {
        var _this = this;
        this.noBackendCache = true;
        return callback().finally(function () {
            _this.noBackendCache = false;
        });
    };
    BackendSrv.prototype.loginPing = function () {
        return this.request({ url: '/api/login/ping', method: 'GET', retry: 1 });
    };
    BackendSrv.prototype.search = function (query) {
        return this.get('/api/search', query);
    };
    BackendSrv.prototype.getDashboardByUid = function (uid) {
        return this.get("/api/dashboards/uid/" + uid);
    };
    BackendSrv.prototype.getFolderByUid = function (uid) {
        return this.get("/api/folders/" + uid);
    };
    return BackendSrv;
}());
export { BackendSrv };
coreModule.factory('backendSrv', function () { return backendSrv; });
// Used for testing and things that really need BackendSrv
export var backendSrv = new BackendSrv();
export var getBackendSrv = function () { return backendSrv; };
//# sourceMappingURL=backend_srv.js.map