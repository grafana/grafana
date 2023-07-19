import { from, lastValueFrom, MonoTypeOperatorFunction, Observable, Subject, Subscription, throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import {
  catchError,
  filter,
  finalize,
  map,
  mergeMap,
  retryWhen,
  share,
  takeUntil,
  tap,
  throwIfEmpty,
} from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { AppEvents, DataQueryErrorType } from '@grafana/data';
import { BackendSrv as BackendService, BackendSrvRequest, config, FetchError, FetchResponse } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { getConfig } from 'app/core/config';
import { loadUrlToken } from 'app/core/utils/urlToken';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardSearchItem } from 'app/features/search/types';
import { TokenRevokedModal } from 'app/features/users/TokenRevokedModal';
import { DashboardDTO, FolderDTO } from 'app/types';

import { ShowModalReactEvent } from '../../types/events';
import {
  isContentTypeApplicationJson,
  parseInitFromOptions,
  parseResponseBody,
  parseUrlFromOptions,
} from '../utils/fetch';
import { isDataQuery, isLocalUrl } from '../utils/query';

import { FetchQueue } from './FetchQueue';
import { FetchQueueWorker } from './FetchQueueWorker';
import { ResponseQueue } from './ResponseQueue';
import { ContextSrv, contextSrv } from './context_srv';

const CANCEL_ALL_REQUESTS_REQUEST_ID = 'cancel_all_requests_request_id';

export interface BackendSrvDependencies {
  fromFetch: (input: string | Request, init?: RequestInit) => Observable<Response>;
  appEvents: typeof appEvents;
  contextSrv: ContextSrv;
  logout: () => void;
}

export interface FolderRequestOptions {
  withAccessControl?: boolean;
}

const GRAFANA_TRACEID_HEADER = 'grafana-trace-id';

export class BackendSrv implements BackendService {
  private inFlightRequests: Subject<string> = new Subject<string>();
  private HTTP_REQUEST_CANCELED = -1;
  private noBackendCache: boolean;
  private inspectorStream: Subject<FetchResponse | FetchError> = new Subject<FetchResponse | FetchError>();
  private readonly fetchQueue: FetchQueue;
  private readonly responseQueue: ResponseQueue;
  private _tokenRotationInProgress?: Observable<FetchResponse> | null = null;

  private dependencies: BackendSrvDependencies = {
    fromFetch: fromFetch,
    appEvents: appEvents,
    contextSrv: contextSrv,
    logout: () => {
      contextSrv.setLoggedOut();
    },
  };

  constructor(deps?: BackendSrvDependencies) {
    if (deps) {
      this.dependencies = {
        ...this.dependencies,
        ...deps,
      };
    }

    this.noBackendCache = false;
    this.internalFetch = this.internalFetch.bind(this);
    this.fetchQueue = new FetchQueue();
    this.responseQueue = new ResponseQueue(this.fetchQueue, this.internalFetch);
    new FetchQueueWorker(this.fetchQueue, this.responseQueue, getConfig());
  }

  async request<T = any>(options: BackendSrvRequest): Promise<T> {
    return await lastValueFrom(this.fetch<T>(options).pipe(map((response: FetchResponse<T>) => response.data)));
  }

  fetch<T>(options: BackendSrvRequest): Observable<FetchResponse<T>> {
    // We need to match an entry added to the queue stream with the entry that is eventually added to the response stream
    const id = uuidv4();
    const fetchQueue = this.fetchQueue;

    return new Observable((observer) => {
      // Subscription is an object that is returned whenever you subscribe to an Observable.
      // You can also use it as a container of many subscriptions and when it is unsubscribed all subscriptions within are also unsubscribed.
      const subscriptions: Subscription = new Subscription();

      // We're using the subscriptions.add function to add the subscription implicitly returned by this.responseQueue.getResponses<T>(id).subscribe below.
      subscriptions.add(
        this.responseQueue.getResponses<T>(id).subscribe((result) => {
          // The one liner below can seem magical if you're not accustomed to RxJs.
          // Firstly, we're subscribing to the result from the result.observable and we're passing in the outer observer object.
          // By passing the outer observer object then any updates on result.observable are passed through to any subscriber of the fetch<T> function.
          // Secondly, we're adding the subscription implicitly returned by result.observable.subscribe(observer).
          subscriptions.add(result.observable.subscribe(observer));
        })
      );

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

  private internalFetch<T>(options: BackendSrvRequest): Observable<FetchResponse<T>> {
    if (options.requestId) {
      this.inFlightRequests.next(options.requestId);
    }

    options = this.parseRequestOptions(options);

    const token = loadUrlToken();
    if (token !== null && token !== '') {
      if (!options.headers) {
        options.headers = {};
      }

      if (config.jwtUrlLogin && config.jwtHeaderName) {
        options.headers[config.jwtHeaderName] = `${token}`;
      }
    }

    return this.getFromFetchStream<T>(options).pipe(
      this.handleStreamResponse<T>(options),
      this.handleStreamError(options),
      this.handleStreamCancellation(options)
    );
  }

  resolveCancelerIfExists(requestId: string) {
    this.inFlightRequests.next(requestId);
  }

  cancelAllInFlightRequests() {
    this.inFlightRequests.next(CANCEL_ALL_REQUESTS_REQUEST_ID);
  }

  async datasourceRequest(options: BackendSrvRequest): Promise<any> {
    return lastValueFrom(this.fetch(options));
  }

  private parseRequestOptions(options: BackendSrvRequest): BackendSrvRequest {
    const orgId = this.dependencies.contextSrv.user?.orgId;

    // init retry counter
    options.retry = options.retry ?? 0;

    if (isLocalUrl(options.url)) {
      if (orgId) {
        options.headers = options.headers ?? {};
        options.headers['X-Grafana-Org-Id'] = orgId;
      }

      if (options.url.startsWith('/')) {
        options.url = options.url.substring(1);
      }

      if (options.headers?.Authorization) {
        options.headers['X-DS-Authorization'] = options.headers.Authorization;
        delete options.headers.Authorization;
      }

      if (this.noBackendCache) {
        options.headers = options.headers ?? {};
        options.headers['X-Grafana-NoCache'] = 'true';
      }
    }

    if (options.hideFromInspector === undefined) {
      // Hide all local non data query calls
      options.hideFromInspector = isLocalUrl(options.url) && !isDataQuery(options.url);
    }

    return options;
  }

  private getFromFetchStream<T>(options: BackendSrvRequest): Observable<FetchResponse<T>> {
    const url = parseUrlFromOptions(options);
    const init = parseInitFromOptions(options);

    return this.dependencies.fromFetch(url, init).pipe(
      mergeMap(async (response) => {
        const { status, statusText, ok, headers, url, type, redirected } = response;

        const responseType = options.responseType ?? (isContentTypeApplicationJson(headers) ? 'json' : undefined);

        const data = await parseResponseBody<T>(response, responseType);
        const fetchResponse: FetchResponse<T> = {
          status,
          statusText,
          ok,
          data,
          headers,
          url,
          type,
          redirected,
          config: options,
          traceId: response.headers.get(GRAFANA_TRACEID_HEADER) ?? undefined,
        };
        return fetchResponse;
      })
    );
  }

  showApplicationErrorAlert(err: FetchError) {}

  showSuccessAlert<T>(response: FetchResponse<T>) {
    const { config } = response;

    if (config.showSuccessAlert === false) {
      return;
    }

    // if showSuccessAlert is undefined we only show alerts non GET request, non data query and local api requests
    if (
      config.showSuccessAlert === undefined &&
      (config.method === 'GET' || isDataQuery(config.url) || !isLocalUrl(config.url))
    ) {
      return;
    }

    const data: { message: string } = response.data as any;

    if (data?.message) {
      this.dependencies.appEvents.emit(AppEvents.alertSuccess, [data.message]);
    }
  }

  showErrorAlert(config: BackendSrvRequest, err: FetchError) {
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
  processRequestError(options: BackendSrvRequest, err: FetchError): FetchError<{ message: string; error?: string }> {
    err.data = err.data ?? { message: 'Unexpected error' };

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

  private handleStreamResponse<T>(options: BackendSrvRequest): MonoTypeOperatorFunction<FetchResponse<T>> {
    return (inputStream) =>
      inputStream.pipe(
        map((response) => {
          if (!response.ok) {
            const { status, statusText, data } = response;
            const fetchErrorResponse: FetchError = {
              status,
              statusText,
              data,
              config: options,
              traceId: response.headers.get(GRAFANA_TRACEID_HEADER) ?? undefined,
            };
            throw fetchErrorResponse;
          }
          return response;
        }),
        tap((response) => {
          this.showSuccessAlert(response);
          this.inspectorStream.next(response);
        })
      );
  }

  private handleStreamError<T>(options: BackendSrvRequest): MonoTypeOperatorFunction<FetchResponse<T>> {
    const { isSignedIn } = this.dependencies.contextSrv.user;

    return (inputStream) =>
      inputStream.pipe(
        retryWhen((attempts: Observable<any>) =>
          attempts.pipe(
            mergeMap((error, i) => {
              const firstAttempt = i === 0 && options.retry === 0;

              if (error.status === 401 && isLocalUrl(options.url) && firstAttempt && isSignedIn) {
                if (error.data?.error?.id === 'ERR_TOKEN_REVOKED') {
                  this.dependencies.appEvents.publish(
                    new ShowModalReactEvent({
                      component: TokenRevokedModal,
                      props: {
                        maxConcurrentSessions: error.data?.error?.maxConcurrentSessions,
                      },
                    })
                  );
                  return throwError(() => error);
                }

                let authChecker = config.featureToggles.clientTokenRotation ? this.rotateToken() : this.loginPing();

                return from(authChecker).pipe(
                  catchError((err) => {
                    if (err.status === 401) {
                      this.dependencies.logout();
                      return throwError(err);
                    }
                    return throwError(err);
                  })
                );
              }

              return throwError(error);
            })
          )
        ),
        catchError((err: FetchError) => throwError(() => this.processRequestError(options, err)))
      );
  }

  private handleStreamCancellation(options: BackendSrvRequest): MonoTypeOperatorFunction<FetchResponse<any>> {
    return (inputStream) =>
      inputStream.pipe(
        takeUntil(
          this.inFlightRequests.pipe(
            filter((requestId) => {
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
            })
          )
        ),
        // when a request is cancelled by takeUntil it will complete without emitting anything so we use throwIfEmpty to identify this case
        // in throwIfEmpty we'll then throw an cancelled error and then we'll return the correct result in the catchError or rethrow
        throwIfEmpty(() => ({
          type: DataQueryErrorType.Cancelled,
          cancelled: true,
          data: null,
          status: this.HTTP_REQUEST_CANCELED,
          statusText: 'Request was aborted',
          config: options,
        }))
      );
  }

  getInspectorStream(): Observable<FetchResponse<any> | FetchError> {
    return this.inspectorStream;
  }

  async get<T = any>(
    url: string,
    params?: BackendSrvRequest['params'],
    requestId?: BackendSrvRequest['requestId'],
    options?: Partial<BackendSrvRequest>
  ) {
    return this.request<T>({ ...options, method: 'GET', url, params, requestId });
  }

  async delete<T = any>(url: string, data?: any, options?: Partial<BackendSrvRequest>) {
    return this.request<T>({ ...options, method: 'DELETE', url, data });
  }

  async post<T = any>(url: string, data?: any, options?: Partial<BackendSrvRequest>) {
    return this.request<T>({ ...options, method: 'POST', url, data });
  }

  async patch<T = any>(url: string, data: any, options?: Partial<BackendSrvRequest>) {
    return this.request<T>({ ...options, method: 'PATCH', url, data });
  }

  async put<T = any>(url: string, data: any, options?: Partial<BackendSrvRequest>): Promise<T> {
    return this.request<T>({ ...options, method: 'PUT', url, data });
  }

  withNoBackendCache(callback: any) {
    this.noBackendCache = true;
    return callback().finally(() => {
      this.noBackendCache = false;
    });
  }

  rotateToken() {
    if (this._tokenRotationInProgress) {
      return this._tokenRotationInProgress;
    }

    this._tokenRotationInProgress = this.fetch({ url: '/api/user/auth-tokens/rotate', method: 'POST', retry: 1 }).pipe(
      finalize(() => {
        this._tokenRotationInProgress = null;
      }),
      share()
    );

    return this._tokenRotationInProgress;
  }

  loginPing() {
    return this.fetch({ url: '/api/login/ping', method: 'GET', retry: 1 });
  }

  /** @deprecated */
  search(query: any): Promise<DashboardSearchItem[]> {
    return this.get('/api/search', query);
  }

  getDashboardByUid(uid: string): Promise<DashboardDTO> {
    return this.get<DashboardDTO>(`/api/dashboards/uid/${uid}`);
  }

  validateDashboard(dashboard: DashboardModel) {
    // We want to send the dashboard as a JSON string (in the JSON body payload) so we can get accurate error line numbers back
    const dashboardJson = JSON.stringify(dashboard, replaceJsonNulls, 2);

    return this.request<ValidateDashboardResponse>({
      method: 'POST',
      url: `/api/dashboards/validate`,
      data: { dashboard: dashboardJson },
      showSuccessAlert: false,
      showErrorAlert: false,
    });
  }

  getPublicDashboardByUid(uid: string) {
    return this.get<DashboardDTO>(`/api/public/dashboards/${uid}`);
  }

  getFolderByUid(uid: string, options: FolderRequestOptions = {}) {
    const queryParams = new URLSearchParams();
    if (options.withAccessControl) {
      queryParams.set('accesscontrol', 'true');
    }

    return this.get<FolderDTO>(`/api/folders/${uid}?${queryParams.toString()}`);
  }
}

// Used for testing and things that really need BackendSrv
export const backendSrv = new BackendSrv();
export const getBackendSrv = (): BackendSrv => backendSrv;

interface ValidateDashboardResponse {
  isValid: boolean;
  message?: string;
}

function replaceJsonNulls<T extends unknown>(key: string, value: T): T | undefined {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}
