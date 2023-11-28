import { __awaiter } from "tslib";
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { from, lastValueFrom, Observable, Subject, Subscription, throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { catchError, filter, finalize, map, mergeMap, retryWhen, share, takeUntil, tap, throwIfEmpty, } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { AppEvents, DataQueryErrorType } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { config } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { getConfig } from 'app/core/config';
import { getSessionExpiry } from 'app/core/utils/auth';
import { loadUrlToken } from 'app/core/utils/urlToken';
import { TokenRevokedModal } from 'app/features/users/TokenRevokedModal';
import { ShowModalReactEvent } from '../../types/events';
import { isContentTypeApplicationJson, parseInitFromOptions, parseResponseBody, parseUrlFromOptions, } from '../utils/fetch';
import { isDataQuery, isLocalUrl } from '../utils/query';
import { FetchQueue } from './FetchQueue';
import { FetchQueueWorker } from './FetchQueueWorker';
import { ResponseQueue } from './ResponseQueue';
import { contextSrv } from './context_srv';
const CANCEL_ALL_REQUESTS_REQUEST_ID = 'cancel_all_requests_request_id';
const GRAFANA_TRACEID_HEADER = 'grafana-trace-id';
export class BackendSrv {
    constructor(deps) {
        this.inFlightRequests = new Subject();
        this.HTTP_REQUEST_CANCELED = -1;
        this.inspectorStream = new Subject();
        this._tokenRotationInProgress = null;
        this.deviceID = null;
        this.dependencies = {
            fromFetch: fromFetch,
            appEvents: appEvents,
            contextSrv: contextSrv,
            logout: () => {
                contextSrv.setLoggedOut();
            },
        };
        if (deps) {
            this.dependencies = Object.assign(Object.assign({}, this.dependencies), deps);
        }
        this.noBackendCache = false;
        this.internalFetch = this.internalFetch.bind(this);
        this.fetchQueue = new FetchQueue();
        this.responseQueue = new ResponseQueue(this.fetchQueue, this.internalFetch);
        this.initGrafanaDeviceID();
        new FetchQueueWorker(this.fetchQueue, this.responseQueue, getConfig());
    }
    initGrafanaDeviceID() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (((_a = config.buildInfo) === null || _a === void 0 ? void 0 : _a.edition) === GrafanaEdition.OpenSource) {
                return;
            }
            try {
                const fp = yield FingerprintJS.load();
                const result = yield fp.get();
                this.deviceID = result.visitorId;
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    request(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield lastValueFrom(this.fetch(options).pipe(map((response) => response.data)));
        });
    }
    fetch(options) {
        // We need to match an entry added to the queue stream with the entry that is eventually added to the response stream
        const id = uuidv4();
        const fetchQueue = this.fetchQueue;
        return new Observable((observer) => {
            // Subscription is an object that is returned whenever you subscribe to an Observable.
            // You can also use it as a container of many subscriptions and when it is unsubscribed all subscriptions within are also unsubscribed.
            const subscriptions = new Subscription();
            // We're using the subscriptions.add function to add the subscription implicitly returned by this.responseQueue.getResponses<T>(id).subscribe below.
            subscriptions.add(this.responseQueue.getResponses(id).subscribe((result) => {
                // The one liner below can seem magical if you're not accustomed to RxJs.
                // Firstly, we're subscribing to the result from the result.observable and we're passing in the outer observer object.
                // By passing the outer observer object then any updates on result.observable are passed through to any subscriber of the fetch<T> function.
                // Secondly, we're adding the subscription implicitly returned by result.observable.subscribe(observer).
                subscriptions.add(result.observable.subscribe(observer));
            }));
            // Let the fetchQueue know that this id needs to start data fetching.
            this.fetchQueue.add(id, options);
            // This returned function will be called whenever the returned Observable from the fetch<T> function is unsubscribed/errored/completed/canceled.
            return function unsubscribe() {
                // Change status to Done moved here from ResponseQueue because this unsubscribe was called before the responseQueue produced a result
                fetchQueue.setDone(id);
                // When subscriptions is unsubscribed all the implicitly added subscriptions above are also unsubscribed.
                subscriptions.unsubscribe();
            };
        });
    }
    internalFetch(options) {
        var _a, _b, _c;
        if (options.requestId) {
            this.inFlightRequests.next(options.requestId);
        }
        options = this.parseRequestOptions(options);
        const token = loadUrlToken();
        if (token !== null && token !== '') {
            if (config.jwtUrlLogin && config.jwtHeaderName) {
                options.headers = (_a = options.headers) !== null && _a !== void 0 ? _a : {};
                options.headers[config.jwtHeaderName] = `${token}`;
            }
        }
        // Add device id header if not OSS build
        if (((_b = config.buildInfo) === null || _b === void 0 ? void 0 : _b.edition) !== GrafanaEdition.OpenSource && this.deviceID) {
            options.headers = (_c = options.headers) !== null && _c !== void 0 ? _c : {};
            options.headers['X-Grafana-Device-Id'] = `${this.deviceID}`;
        }
        return this.getFromFetchStream(options).pipe(this.handleStreamResponse(options), this.handleStreamError(options), this.handleStreamCancellation(options));
    }
    resolveCancelerIfExists(requestId) {
        this.inFlightRequests.next(requestId);
    }
    cancelAllInFlightRequests() {
        this.inFlightRequests.next(CANCEL_ALL_REQUESTS_REQUEST_ID);
    }
    datasourceRequest(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return lastValueFrom(this.fetch(options));
        });
    }
    parseRequestOptions(options) {
        var _a, _b, _c, _d, _e;
        const orgId = (_a = this.dependencies.contextSrv.user) === null || _a === void 0 ? void 0 : _a.orgId;
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
    }
    getFromFetchStream(options) {
        const url = parseUrlFromOptions(options);
        const init = parseInitFromOptions(options);
        return this.dependencies.fromFetch(url, init).pipe(mergeMap((response) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { status, statusText, ok, headers, url, type, redirected } = response;
            const responseType = (_a = options.responseType) !== null && _a !== void 0 ? _a : (isContentTypeApplicationJson(headers) ? 'json' : undefined);
            const data = yield parseResponseBody(response, responseType);
            const fetchResponse = {
                status,
                statusText,
                ok,
                data,
                headers,
                url,
                type,
                redirected,
                config: options,
                traceId: (_b = response.headers.get(GRAFANA_TRACEID_HEADER)) !== null && _b !== void 0 ? _b : undefined,
            };
            return fetchResponse;
        })));
    }
    showApplicationErrorAlert(err) { }
    showSuccessAlert(response) {
        const { config } = response;
        if (config.showSuccessAlert === false) {
            return;
        }
        // if showSuccessAlert is undefined we only show alerts non GET request, non data query and local api requests
        if (config.showSuccessAlert === undefined &&
            (config.method === 'GET' || isDataQuery(config.url) || !isLocalUrl(config.url))) {
            return;
        }
        const data = response.data;
        if (data === null || data === void 0 ? void 0 : data.message) {
            this.dependencies.appEvents.emit(AppEvents.alertSuccess, [data.message]);
        }
    }
    showErrorAlert(config, err) {
        if (config.showErrorAlert === false) {
            return;
        }
        // is showErrorAlert is undefined we only show alerts non data query and local api requests
        if (config.showErrorAlert === undefined && (isDataQuery(config.url) || !isLocalUrl(config.url))) {
            return;
        }
        let description = '';
        let message = err.data.message;
        // Sometimes we have a better error message on err.message
        if (message === 'Unexpected error' && err.message) {
            message = err.message;
        }
        if (message.length > 80) {
            description = message;
            message = 'Error';
        }
        // Validation
        if (err.status === 422) {
            description = err.data.message;
            message = 'Validation failed';
        }
        this.dependencies.appEvents.emit(err.status < 500 ? AppEvents.alertWarning : AppEvents.alertError, [
            message,
            description,
            err.data.traceID,
        ]);
    }
    /**
     * Processes FetchError to ensure "data" property is an object.
     *
     * @see DataQueryError.data
     */
    processRequestError(options, err) {
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
            setTimeout(() => {
                if (!err.isHandled) {
                    this.showErrorAlert(options, err);
                }
            }, 50);
        }
        this.inspectorStream.next(err);
        return err;
    }
    handleStreamResponse(options) {
        return (inputStream) => inputStream.pipe(map((response) => {
            var _a;
            if (!response.ok) {
                const { status, statusText, data } = response;
                const fetchErrorResponse = {
                    status,
                    statusText,
                    data,
                    config: options,
                    traceId: (_a = response.headers.get(GRAFANA_TRACEID_HEADER)) !== null && _a !== void 0 ? _a : undefined,
                };
                throw fetchErrorResponse;
            }
            return response;
        }), tap((response) => {
            this.showSuccessAlert(response);
            this.inspectorStream.next(response);
        }));
    }
    handleStreamError(options) {
        const { isSignedIn } = this.dependencies.contextSrv.user;
        return (inputStream) => inputStream.pipe(retryWhen((attempts) => attempts.pipe(mergeMap((error, i) => {
            var _a, _b, _c, _d;
            const firstAttempt = i === 0 && options.retry === 0;
            if (error.status === 401 && isLocalUrl(options.url) && firstAttempt && isSignedIn) {
                if (((_b = (_a = error.data) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.id) === 'ERR_TOKEN_REVOKED') {
                    this.dependencies.appEvents.publish(new ShowModalReactEvent({
                        component: TokenRevokedModal,
                        props: {
                            maxConcurrentSessions: (_d = (_c = error.data) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.maxConcurrentSessions,
                        },
                    }));
                    return throwError(() => error);
                }
                let authChecker = this.loginPing();
                const expired = getSessionExpiry() * 1000 < Date.now();
                if (config.featureToggles.clientTokenRotation && expired) {
                    authChecker = this.rotateToken();
                }
                return from(authChecker).pipe(catchError((err) => {
                    if (err.status === 401) {
                        this.dependencies.logout();
                        return throwError(err);
                    }
                    return throwError(err);
                }));
            }
            return throwError(error);
        }))), catchError((err) => throwError(() => this.processRequestError(options, err))));
    }
    handleStreamCancellation(options) {
        return (inputStream) => inputStream.pipe(takeUntil(this.inFlightRequests.pipe(filter((requestId) => {
            let cancelRequest = false;
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
        throwIfEmpty(() => ({
            type: DataQueryErrorType.Cancelled,
            cancelled: true,
            data: null,
            status: this.HTTP_REQUEST_CANCELED,
            statusText: 'Request was aborted',
            config: options,
        })));
    }
    getInspectorStream() {
        return this.inspectorStream;
    }
    get(url, params, requestId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request(Object.assign(Object.assign({}, options), { method: 'GET', url, params, requestId }));
        });
    }
    delete(url, data, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request(Object.assign(Object.assign({}, options), { method: 'DELETE', url, data }));
        });
    }
    post(url, data, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request(Object.assign(Object.assign({}, options), { method: 'POST', url, data }));
        });
    }
    patch(url, data, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request(Object.assign(Object.assign({}, options), { method: 'PATCH', url, data }));
        });
    }
    put(url, data, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request(Object.assign(Object.assign({}, options), { method: 'PUT', url, data }));
        });
    }
    withNoBackendCache(callback) {
        this.noBackendCache = true;
        return callback().finally(() => {
            this.noBackendCache = false;
        });
    }
    rotateToken() {
        if (this._tokenRotationInProgress) {
            return this._tokenRotationInProgress;
        }
        this._tokenRotationInProgress = this.fetch({ url: '/api/user/auth-tokens/rotate', method: 'POST', retry: 1 }).pipe(finalize(() => {
            this._tokenRotationInProgress = null;
        }), share());
        return this._tokenRotationInProgress;
    }
    loginPing() {
        return this.fetch({ url: '/api/login/ping', method: 'GET', retry: 1 });
    }
    /** @deprecated */
    search(query) {
        return this.get('/api/search', query);
    }
    getDashboardByUid(uid) {
        return this.get(`/api/dashboards/uid/${uid}`);
    }
    validateDashboard(dashboard) {
        // We want to send the dashboard as a JSON string (in the JSON body payload) so we can get accurate error line numbers back
        const dashboardJson = JSON.stringify(dashboard, replaceJsonNulls, 2);
        return this.request({
            method: 'POST',
            url: `/api/dashboards/validate`,
            data: { dashboard: dashboardJson },
            showSuccessAlert: false,
            showErrorAlert: false,
        });
    }
    getPublicDashboardByUid(uid) {
        return this.get(`/api/public/dashboards/${uid}`);
    }
    getFolderByUid(uid, options = {}) {
        const queryParams = new URLSearchParams();
        if (options.withAccessControl) {
            queryParams.set('accesscontrol', 'true');
        }
        return this.get(`/api/folders/${uid}?${queryParams.toString()}`, undefined, undefined, {
            showErrorAlert: false,
        });
    }
}
// Used for testing and things that really need BackendSrv
export const backendSrv = new BackendSrv();
export const getBackendSrv = () => backendSrv;
function replaceJsonNulls(key, value) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
        return undefined;
    }
    return value;
}
//# sourceMappingURL=backend_srv.js.map