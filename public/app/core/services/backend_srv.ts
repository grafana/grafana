import { from, merge, MonoTypeOperatorFunction, Observable, Subject, Subscription, throwError } from 'rxjs';
import { catchError, filter, map, mergeMap, retryWhen, share, takeUntil, tap, throwIfEmpty } from 'rxjs/operators';
import { fromFetch } from 'rxjs/fetch';
import { v4 as uuidv4 } from 'uuid';
import { BackendSrv as BackendService, BackendSrvRequest, FetchResponse, FetchError } from '@grafana/runtime';
import { AppEvents, DataQueryErrorType } from '@grafana/data';

import appEvents from 'app/core/app_events';
import config, { getConfig } from 'app/core/config';
import { DashboardSearchHit } from 'app/features/search/types';
import { FolderDTO } from 'app/types';
import { coreModule } from 'app/core/core_module';
import { ContextSrv, contextSrv } from './context_srv';
import { Emitter } from '../utils/emitter';
import { parseInitFromOptions, parseUrlFromOptions } from '../utils/fetch';
import { isDataQuery, isLocalUrl } from '../utils/query';
import { FetchQueue } from './FetchQueue';
import { ResponseQueue } from './ResponseQueue';
import { FetchQueueWorker } from './FetchQueueWorker';

const CANCEL_ALL_REQUESTS_REQUEST_ID = 'cancel_all_requests_request_id';

export interface BackendSrvDependencies {
  fromFetch: (input: string | Request, init?: RequestInit) => Observable<Response>;
  appEvents: Emitter;
  contextSrv: ContextSrv;
  logout: () => void;
}

export class BackendSrv implements BackendService {
  private inFlightRequests: Subject<string> = new Subject<string>();
  private HTTP_REQUEST_CANCELED = -1;
  private noBackendCache: boolean;
  private inspectorStream: Subject<FetchResponse | FetchError> = new Subject<FetchResponse | FetchError>();
  private readonly fetchQueue: FetchQueue;
  private readonly responseQueue: ResponseQueue;

  private dependencies: BackendSrvDependencies = {
    fromFetch: fromFetch,
    appEvents: appEvents,
    contextSrv: contextSrv,
    logout: () => {
      window.location.href = config.appSubUrl + '/logout';
    },
  };

  constructor(deps?: BackendSrvDependencies) {
    if (deps) {
      this.dependencies = {
        ...this.dependencies,
        ...deps,
      };
    }

    this.internalFetch = this.internalFetch.bind(this);
    this.fetchQueue = new FetchQueue();
    this.responseQueue = new ResponseQueue(this.fetchQueue, this.internalFetch);
    new FetchQueueWorker(this.fetchQueue, this.responseQueue, getConfig());
  }

  async request<T = any>(options: BackendSrvRequest): Promise<T> {
    return this.fetch<T>(options)
      .pipe(map((response: FetchResponse<T>) => response.data))
      .toPromise();
  }

  fetch<T>(options: BackendSrvRequest): Observable<FetchResponse<T>> {
    return new Observable(observer => {
      // We need to match an entry added to the queue stream with the entry that is eventually added to the response stream
      const id = uuidv4();

      // Subscription is an object that is returned whenever you subscribe to an Observable.
      // You can also use it as a container of many subscriptions and when it is unsubscribed all subscriptions within are also unsubscribed.
      const subscriptions: Subscription = new Subscription();

      // We're using the subscriptions.add function to add the subscription implicitly returned by this.responseQueue.getResponses<T>(id).subscribe below.
      subscriptions.add(
        this.responseQueue.getResponses<T>(id).subscribe(result => {
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

    const fromFetchStream = this.getFromFetchStream<T>(options);
    const failureStream = fromFetchStream.pipe(this.toFailureStream<T>(options));
    const successStream = fromFetchStream.pipe(
      filter(response => response.ok === true),
      tap(response => {
        this.showSuccessAlert(response);
        this.inspectorStream.next(response);
      })
    );

    return merge(successStream, failureStream).pipe(
      catchError((err: FetchError) => throwError(this.processRequestError(options, err))),
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
    return this.fetch(options).toPromise();
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
      mergeMap(async response => {
        const { status, statusText, ok, headers, url, type, redirected } = response;
        const textData = await response.text(); // this could be just a string, prometheus requests for instance
        let data: T;

        try {
          data = JSON.parse(textData); // majority of the requests this will be something that can be parsed
        } catch {
          data = textData as any;
        }

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
        };
        return fetchResponse;
      }),
      share() // sharing this so we can split into success and failure and then merge back
    );
  }

  private toFailureStream<T>(options: BackendSrvRequest): MonoTypeOperatorFunction<FetchResponse<T>> {
    const { isSignedIn } = this.dependencies.contextSrv.user;

    return inputStream =>
      inputStream.pipe(
        filter(response => response.ok === false),
        mergeMap(response => {
          const { status, statusText, data } = response;
          const fetchErrorResponse: FetchError = { status, statusText, data, config: options };
          return throwError(fetchErrorResponse);
        }),
        retryWhen((attempts: Observable<any>) =>
          attempts.pipe(
            mergeMap((error, i) => {
              const firstAttempt = i === 0 && options.retry === 0;

              if (error.status === 401 && isLocalUrl(options.url) && firstAttempt && isSignedIn) {
                return from(this.loginPing()).pipe(
                  catchError(err => {
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
        )
      );
  }

  showApplicationErrorAlert(err: FetchError) {}

  showSuccessAlert<T>(response: FetchResponse<T>) {
    const { config } = response;

    if (config.showSuccessAlert === false) {
      return;
    }

    // is showSuccessAlert is undefined we only show alerts non GET request, non data query and local api requests
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

  showErrorAlert<T>(config: BackendSrvRequest, err: FetchError) {
    if (config.showErrorAlert === false) {
      return;
    }

    // is showErrorAlert is undefined we only show alerts non data query and local api requests
    if (config.showErrorAlert === undefined && (isDataQuery(config.url) || !isLocalUrl(config.url))) {
      return;
    }

    let description = '';
    let message = err.data.message;

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
  }

  processRequestError(options: BackendSrvRequest, err: FetchError): FetchError {
    err.data = err.data ?? { message: 'Unexpected error' };

    if (typeof err.data === 'string') {
      err.data = {
        error: err.statusText,
        response: err.data,
        message: err.data,
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

  private handleStreamCancellation(options: BackendSrvRequest): MonoTypeOperatorFunction<FetchResponse<any>> {
    return inputStream =>
      inputStream.pipe(
        takeUntil(
          this.inFlightRequests.pipe(
            filter(requestId => {
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

  async get<T = any>(url: string, params?: any, requestId?: string): Promise<T> {
    return await this.request({ method: 'GET', url, params, requestId });
  }

  async delete(url: string) {
    return await this.request({ method: 'DELETE', url });
  }

  async post(url: string, data?: any) {
    return await this.request({ method: 'POST', url, data });
  }

  async patch(url: string, data: any) {
    return await this.request({ method: 'PATCH', url, data });
  }

  async put(url: string, data: any) {
    return await this.request({ method: 'PUT', url, data });
  }

  withNoBackendCache(callback: any) {
    this.noBackendCache = true;
    return callback().finally(() => {
      this.noBackendCache = false;
    });
  }

  loginPing() {
    return this.request({ url: '/api/login/ping', method: 'GET', retry: 1 });
  }

  search(query: any): Promise<DashboardSearchHit[]> {
    return this.get('/api/search', query);
  }

  getDashboardBySlug(slug: string) {
    return this.get(`/api/dashboards/db/${slug}`);
  }

  getDashboardByUid(uid: string) {
    return this.get(`/api/dashboards/uid/${uid}`);
  }

  getFolderByUid(uid: string) {
    return this.get<FolderDTO>(`/api/folders/${uid}`);
  }
}

coreModule.factory('backendSrv', () => backendSrv);
// Used for testing and things that really need BackendSrv
export const backendSrv = new BackendSrv();
export const getBackendSrv = (): BackendSrv => backendSrv;
