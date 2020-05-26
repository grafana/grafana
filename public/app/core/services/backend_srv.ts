import { from, merge, MonoTypeOperatorFunction, Observable, of, Subject, throwError } from 'rxjs';
import { catchError, filter, map, mergeMap, retryWhen, share, takeUntil, tap, throwIfEmpty } from 'rxjs/operators';
import { fromFetch } from 'rxjs/fetch';
import { BackendSrv as BackendService, BackendSrvRequest } from '@grafana/runtime';
import { AppEvents } from '@grafana/data';

import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import { DataSourceResponse } from 'app/types/events';
import { DashboardSearchHit } from 'app/features/search/types';
import { CoreEvents, DashboardDTO, FolderInfo, DashboardDataDTO } from 'app/types';
import { coreModule } from 'app/core/core_module';
import { ContextSrv, contextSrv } from './context_srv';
import { Emitter } from '../utils/emitter';
import { parseInitFromOptions, parseUrlFromOptions } from '../utils/fetch';

export interface DatasourceRequestOptions {
  retry?: number;
  method?: string;
  requestId?: string;
  timeout?: Promise<any>;
  url?: string;
  headers?: Record<string, any>;
  silent?: boolean;
  data?: Record<string, any>;
}

interface FetchResponseProps {
  message?: string;
}

interface ErrorResponseProps extends FetchResponseProps {
  status?: string;
  error?: string | any;
}

export interface FetchResponse<T extends FetchResponseProps = any> extends DataSourceResponse<T> {}

interface SuccessResponse extends FetchResponseProps, Record<any, any> {}

interface DataSourceSuccessResponse<T extends {} = any> extends FetchResponse<T> {}

interface ErrorResponse<T extends ErrorResponseProps = any> {
  status: number;
  statusText?: string;
  isHandled?: boolean;
  data: T | string;
  cancelled?: boolean;
}

enum CancellationType {
  request,
  dataSourceRequest,
}

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
  }

  async get(url: string, params?: any, requestId?: string) {
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

  requestErrorHandler = (err: ErrorResponse) => {
    if (err.isHandled) {
      return;
    }

    let data = err.data ?? { message: 'Unexpected error' };
    if (typeof data === 'string') {
      data = { message: data };
    }

    if (err.status === 422) {
      this.dependencies.appEvents.emit(AppEvents.alertWarning, ['Validation failed', data.message]);
      throw data;
    }

    if (data.message) {
      let description = '';
      let message = data.message;
      if (message.length > 80) {
        description = message;
        message = 'Error';
      }

      this.dependencies.appEvents.emit(err.status < 500 ? AppEvents.alertWarning : AppEvents.alertError, [
        message,
        description,
      ]);
    }

    throw data;
  };

  async request(options: BackendSrvRequest): Promise<any> {
    // A requestId is a unique identifier for a particular query.
    // Every observable below has a takeUntil that subscribes to this.inFlightRequests and
    // will cancel/unsubscribe that observable when a new datasourceRequest with the same requestId is made
    if (options.requestId) {
      this.inFlightRequests.next(options.requestId);
    }

    options = this.parseRequestOptions(options, this.dependencies.contextSrv.user?.orgId);

    const fromFetchStream = this.getFromFetchStream(options);
    const failureStream = fromFetchStream.pipe(this.toFailureStream(options));
    const successStream = fromFetchStream.pipe(
      filter(response => response.ok === true),
      map(response => {
        const fetchSuccessResponse: SuccessResponse = response.data;
        return fetchSuccessResponse;
      }),
      tap(response => {
        if (options.method !== 'GET' && response?.message && options.showSuccessAlert !== false) {
          this.dependencies.appEvents.emit(AppEvents.alertSuccess, [response.message]);
        }
      })
    );

    return merge(successStream, failureStream)
      .pipe(
        catchError((err: ErrorResponse) => {
          // this setTimeout hack enables any caller catching this err to set isHandled to true
          setTimeout(() => this.requestErrorHandler(err), 50);
          return throwError(err);
        }),
        this.handleStreamCancellation(options, CancellationType.request)
      )
      .toPromise();
  }

  resolveCancelerIfExists(requestId: string) {
    this.inFlightRequests.next(requestId);
  }

  async datasourceRequest(options: BackendSrvRequest): Promise<any> {
    // A requestId is provided by the datasource as a unique identifier for a
    // particular query. Every observable below has a takeUntil that subscribes to this.inFlightRequests and
    // will cancel/unsubscribe that observable when a new datasourceRequest with the same requestId is made
    if (options.requestId) {
      this.inFlightRequests.next(options.requestId);
    }

    options = this.parseDataSourceRequestOptions(
      options,
      this.dependencies.contextSrv.user?.orgId,
      this.noBackendCache
    );

    const fromFetchStream = this.getFromFetchStream(options);
    const failureStream = fromFetchStream.pipe(this.toDataSourceRequestFailureStream(options));
    const successStream = fromFetchStream.pipe(
      filter(response => response.ok === true),
      map(response => {
        const fetchSuccessResponse: DataSourceSuccessResponse = { ...response };
        return fetchSuccessResponse;
      }),
      tap(res => {
        if (!options.silent) {
          this.dependencies.appEvents.emit(CoreEvents.dsRequestResponse, res);
        }
      })
    );

    return merge(successStream, failureStream)
      .pipe(
        catchError((err: ErrorResponse) => {
          // populate error obj on Internal Error
          if (typeof err.data === 'string' && err.status === 500) {
            err.data = {
              error: err.statusText,
              response: err.data,
            };
          }

          // for Prometheus
          if (err.data && !err.data.message && typeof err.data.error === 'string') {
            err.data.message = err.data.error;
          }

          if (!options.silent) {
            this.dependencies.appEvents.emit(CoreEvents.dsRequestError, err);
          }

          return throwError(err);
        }),
        this.handleStreamCancellation(options, CancellationType.dataSourceRequest)
      )
      .toPromise();
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
    return this.get(`/api/folders/${uid}`);
  }

  saveDashboard(
    dashboard: DashboardDataDTO,
    { message = '', folderId, overwrite = false }: { message?: string; folderId?: number; overwrite?: boolean } = {}
  ) {
    return this.post('/api/dashboards/db/', {
      dashboard,
      folderId,
      overwrite,
      message,
    });
  }

  createFolder(payload: any) {
    return this.post('/api/folders', payload);
  }

  deleteFolder(uid: string, showSuccessAlert: boolean) {
    return this.request({ method: 'DELETE', url: `/api/folders/${uid}`, showSuccessAlert: showSuccessAlert === true });
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean) {
    return this.request({
      method: 'DELETE',
      url: `/api/dashboards/uid/${uid}`,
      showSuccessAlert: showSuccessAlert === true,
    });
  }

  deleteFoldersAndDashboards(folderUids: string[], dashboardUids: string[]) {
    const tasks = [];

    for (const folderUid of folderUids) {
      tasks.push(this.createTask(this.deleteFolder.bind(this), true, folderUid, true));
    }

    for (const dashboardUid of dashboardUids) {
      tasks.push(this.createTask(this.deleteDashboard.bind(this), true, dashboardUid, true));
    }

    return this.executeInOrder(tasks);
  }

  moveDashboards(dashboardUids: string[], toFolder: FolderInfo) {
    const tasks = [];

    for (const uid of dashboardUids) {
      tasks.push(this.createTask(this.moveDashboard.bind(this), true, uid, toFolder));
    }

    return this.executeInOrder(tasks).then((result: any) => {
      return {
        totalCount: result.length,
        successCount: result.filter((res: any) => res.succeeded).length,
        alreadyInFolderCount: result.filter((res: any) => res.alreadyInFolder).length,
      };
    });
  }

  private async moveDashboard(uid: string, toFolder: FolderInfo) {
    const fullDash: DashboardDTO = await this.getDashboardByUid(uid);

    if ((!fullDash.meta.folderId && toFolder.id === 0) || fullDash.meta.folderId === toFolder.id) {
      return { alreadyInFolder: true };
    }

    const clone = fullDash.dashboard;
    const options = {
      folderId: toFolder.id,
      overwrite: false,
    };

    try {
      await this.saveDashboard(clone, options);
      return { succeeded: true };
    } catch (err) {
      if (err.data?.status !== 'plugin-dashboard') {
        return { succeeded: false };
      }

      err.isHandled = true;
      options.overwrite = true;

      try {
        await this.saveDashboard(clone, options);
        return { succeeded: true };
      } catch (e) {
        return { succeeded: false };
      }
    }
  }

  private createTask(fn: (...args: any[]) => Promise<any>, ignoreRejections: boolean, ...args: any[]) {
    return async (result: any) => {
      try {
        const res = await fn(...args);
        return Array.prototype.concat(result, [res]);
      } catch (err) {
        if (ignoreRejections) {
          return result;
        }

        throw err;
      }
    };
  }

  private executeInOrder(tasks: any[]) {
    return tasks.reduce((acc, task) => {
      return Promise.resolve(acc).then(task);
    }, []);
  }

  private parseRequestOptions = (options: BackendSrvRequest, orgId?: number): BackendSrvRequest => {
    options.retry = options.retry ?? 0;
    const requestIsLocal = !options.url.match(/^http/);

    if (requestIsLocal) {
      if (orgId) {
        options.headers = options.headers ?? {};
        options.headers['X-Grafana-Org-Id'] = orgId;
      }

      if (options.url.startsWith('/')) {
        options.url = options.url.substring(1);
      }

      if (options.url.endsWith('/')) {
        options.url = options.url.slice(0, -1);
      }
    }

    return options;
  };

  private parseDataSourceRequestOptions = (
    options: BackendSrvRequest,
    orgId?: number,
    noBackendCache?: boolean
  ): BackendSrvRequest => {
    options.retry = options.retry ?? 0;
    const requestIsLocal = !options.url.match(/^http/);

    if (requestIsLocal) {
      if (orgId) {
        options.headers = options.headers || {};
        options.headers['X-Grafana-Org-Id'] = orgId;
      }

      if (options.url.startsWith('/')) {
        options.url = options.url.substring(1);
      }

      if (options.headers?.Authorization) {
        options.headers['X-DS-Authorization'] = options.headers.Authorization;
        delete options.headers.Authorization;
      }

      if (noBackendCache) {
        options.headers['X-Grafana-NoCache'] = 'true';
      }
    }

    return options;
  };

  private getFromFetchStream = (options: BackendSrvRequest) => {
    const url = parseUrlFromOptions(options);
    const init = parseInitFromOptions(options);
    return this.dependencies.fromFetch(url, init).pipe(
      mergeMap(async response => {
        const { status, statusText, ok, headers, url, type, redirected } = response;
        const textData = await response.text(); // this could be just a string, prometheus requests for instance
        let data;
        try {
          data = JSON.parse(textData); // majority of the requests this will be something that can be parsed
        } catch {
          data = textData;
        }
        const fetchResponse: FetchResponse = {
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
  };

  private toFailureStream = (options: BackendSrvRequest): MonoTypeOperatorFunction<FetchResponse> => inputStream =>
    inputStream.pipe(
      filter(response => response.ok === false),
      mergeMap(response => {
        const { status, statusText, data } = response;
        const fetchErrorResponse: ErrorResponse = { status, statusText, data };
        return throwError(fetchErrorResponse);
      }),
      retryWhen((attempts: Observable<any>) =>
        attempts.pipe(
          mergeMap((error, i) => {
            const firstAttempt = i === 0 && options.retry === 0;

            if (error.status === 401 && this.dependencies.contextSrv.user.isSignedIn && firstAttempt) {
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

  private toDataSourceRequestFailureStream = (
    options: BackendSrvRequest
  ): MonoTypeOperatorFunction<FetchResponse> => inputStream =>
    inputStream.pipe(
      filter(response => response.ok === false),
      mergeMap(response => {
        const { status, statusText, data } = response;
        const fetchErrorResponse: ErrorResponse = { status, statusText, data };
        return throwError(fetchErrorResponse);
      }),
      retryWhen((attempts: Observable<any>) =>
        attempts.pipe(
          mergeMap((error, i) => {
            const requestIsLocal = !options.url.match(/^http/);
            const firstAttempt = i === 0 && options.retry === 0;

            // First retry, if loginPing returns 401 this retry sequence will abort with throwError and user is logged out
            if (requestIsLocal && firstAttempt && error.status === 401) {
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

  private handleStreamCancellation = (
    options: BackendSrvRequest,
    resultType: CancellationType
  ): MonoTypeOperatorFunction<FetchResponse | DataSourceSuccessResponse | SuccessResponse> => inputStream =>
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
            return cancelRequest;
          })
        )
      ),
      // when a request is cancelled by takeUntil it will complete without emitting anything so we use throwIfEmpty to identify this case
      // in throwIfEmpty we'll then throw an cancelled error and then we'll return the correct result in the catchError or rethrow
      throwIfEmpty(() => ({
        cancelled: true,
      })),
      catchError(err => {
        if (!err.cancelled) {
          return throwError(err);
        }

        if (resultType === CancellationType.dataSourceRequest) {
          return of({
            data: [],
            status: this.HTTP_REQUEST_CANCELED,
            statusText: 'Request was aborted',
            config: options,
          });
        }

        return of([]);
      })
    );
}

coreModule.factory('backendSrv', () => backendSrv);
// Used for testing and things that really need BackendSrv
export const backendSrv = new BackendSrv();
export const getBackendSrv = (): BackendSrv => backendSrv;
