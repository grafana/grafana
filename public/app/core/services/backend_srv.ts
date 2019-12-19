import omitBy from 'lodash/omitBy';

import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardSearchHit } from 'app/types/search';
import { CoreEvents, DashboardDTO, FolderInfo } from 'app/types';
import { BackendSrv as BackendService, BackendSrvRequest } from '@grafana/runtime';
import { AppEvents } from '@grafana/data';
import { contextSrv } from './context_srv';
import { from, Observable, of, Subject, throwError } from 'rxjs';
import { catchError, finalize, map, mergeMap, retryWhen, takeUntil, tap } from 'rxjs/operators';
import { fromFetch } from 'rxjs/fetch';
import { coreModule } from 'app/core/core_module';

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

function serializeParams(data: Record<string, any>) {
  return Object.keys(data)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&');
}

export class BackendSrv implements BackendService {
  private inFlightRequests: Record<string, Array<Subject<any>>> = {};
  private HTTP_REQUEST_CANCELED = -1;
  private noBackendCache: boolean;

  async get(url: string, params?: any) {
    return await this.request({ method: 'GET', url, params });
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

  requestErrorHandler(err: any) {
    if (err.isHandled) {
      return;
    }

    let data = err.data ?? { message: 'Unexpected error' };
    if (typeof data === 'string') {
      data = { message: data };
    }

    if (err.status === 422) {
      appEvents.emit(AppEvents.alertWarning, ['Validation failed', data.message]);
      throw data;
    }

    if (data.message) {
      let description = '';
      let message = data.message;
      if (message.length > 80) {
        description = message;
        message = 'Error';
      }

      appEvents.emit(err.status < 500 ? AppEvents.alertWarning : AppEvents.alertError, [message, description]);
    }

    throw data;
  }

  async request(options: BackendSrvRequest): Promise<any> {
    options.retry = options.retry ?? 0;
    const requestIsLocal = !options.url.match(/^http/);

    if (requestIsLocal) {
      if (contextSrv.user?.orgId) {
        options.headers = options.headers ?? {};
        options.headers['X-Grafana-Org-Id'] = contextSrv.user.orgId;
      }

      if (options.url.startsWith('/')) {
        options.url = options.url.substring(1);
      }

      if (options.url.endsWith('/')) {
        options.url = options.url.slice(0, -1);
      }
    }

    const cleanParams = omitBy(options.params, v => v === undefined || v.length === 0);
    return fromFetch(options.params ? `${options.url}?${serializeParams(cleanParams)}` : options.url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        ...options.headers,
      },
      body: JSON.stringify(options.data),
    })
      .pipe(
        mergeMap(res => {
          if (res.ok) {
            return res.json();
          } else {
            return throwError(res);
          }
        }),
        tap(res => {
          if (options.method !== 'GET' && res?.message && options.showSuccessAlert) {
            appEvents.emit(AppEvents.alertSuccess, [res.message]);
          }
        }),
        retryWhen((attempts: Observable<any>) =>
          attempts.pipe(
            mergeMap((error, i) => {
              const firstAttempt = i === 0 && options.retry === 0;

              if (error.status !== 401 || !contextSrv.user.isSignedIn || !firstAttempt) {
                return throwError(error);
              }

              return from(this.loginPing());
            })
          )
        ),
        catchError(err => {
          if (err.status === 401) {
            window.location.href = config.appSubUrl + '/logout';
            return throwError(err);
          }

          setTimeout(this.requestErrorHandler.bind(this, err), 50);
          return throwError(err);
        })
      )
      .toPromise();
  }

  addCanceler(requestId: string, canceler: Subject<any>) {
    if (requestId in this.inFlightRequests) {
      this.inFlightRequests[requestId].push(canceler);
    } else {
      this.inFlightRequests[requestId] = [canceler];
    }
  }

  resolveCancelerIfExists(requestId: string) {
    const cancelers = this.inFlightRequests[requestId];
    if (cancelers && cancelers.length) {
      cancelers[0].next();
    }
  }

  async datasourceRequest(options: BackendSrvRequest): Promise<any> {
    let canceler: Subject<any>;
    options.retry = options.retry ?? 0;

    // A requestID is provided by the datasource as a unique identifier for a
    // particular query. If the requestID exists, the promise it is keyed to
    // is canceled, canceling the previous datasource request if it is still
    // in-flight.
    const requestId = options.requestId;

    if (requestId) {
      this.resolveCancelerIfExists(requestId);
      // create new canceler
      canceler = new Subject();
      this.addCanceler(requestId, canceler);
    }

    const requestIsLocal = !options.url.match(/^http/);

    if (requestIsLocal) {
      if (contextSrv.user?.orgId) {
        options.headers = options.headers || {};
        options.headers['X-Grafana-Org-Id'] = contextSrv.user.orgId;
      }

      if (options.url.startsWith('/')) {
        options.url = options.url.substring(1);
      }

      if (options.headers?.Authorization) {
        options.headers['X-DS-Authorization'] = options.headers.Authorization;
        delete options.headers.Authorization;
      }

      if (this.noBackendCache) {
        options.headers['X-Grafana-NoCache'] = 'true';
      }
    }

    const cleanParams = omitBy(options.params, v => v === undefined || v.length === 0);
    return fromFetch(options.params ? `${options.url}?${serializeParams(cleanParams)}` : options.url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        ...options.headers,
      },
      body: JSON.stringify(options.data),
    })
      .pipe(
        mergeMap(res => {
          if (res.ok) {
            return res.json();
          } else {
            return throwError(res);
          }
        }),
        tap(res => {
          if (!options.silent) {
            appEvents.emit(CoreEvents.dsRequestResponse, res);
          }
        }),
        map(res => ({ data: res })),
        retryWhen((attempts: Observable<any>) =>
          attempts.pipe(
            mergeMap((error, i) => {
              const firstAttempt = i === 0  && options.retry === 0;

              if (error.status !== 401 || !requestIsLocal || !firstAttempt) {
                return throwError(error);
              }

              return from(this.loginPing());
            })
          )
        ),
        catchError(err => {
          if (err.status === this.HTTP_REQUEST_CANCELED) {
            return throwError({ err, cancelled: true });
          }

          if (err.status === 401) {
            window.location.href = config.appSubUrl + '/logout';
            return throwError(err);
          }

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
            appEvents.emit(CoreEvents.dsRequestError, err);
          }

          return throwError(err);
        }),
        takeUntil(canceler ?? of()),
        finalize(() => {
          if (options.requestId) {
            this.inFlightRequests[options.requestId].shift();
          }
        })
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
    dash: DashboardModel,
    { message = '', folderId, overwrite = false }: { message?: string; folderId?: number; overwrite?: boolean } = {}
  ) {
    return this.post('/api/dashboards/db/', {
      dashboard: dash,
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

    return this.executeInOrder(tasks, []);
  }

  moveDashboards(dashboardUids: string[], toFolder: FolderInfo) {
    const tasks = [];

    for (const uid of dashboardUids) {
      tasks.push(this.createTask(this.moveDashboard.bind(this), true, uid, toFolder));
    }

    return this.executeInOrder(tasks, []).then((result: any) => {
      return {
        totalCount: result.length,
        successCount: result.filter((res: any) => res.succeeded).length,
        alreadyInFolderCount: result.filter((res: any) => res.alreadyInFolder).length,
      };
    });
  }

  private async moveDashboard(uid: string, toFolder: FolderInfo) {
    const fullDash: DashboardDTO = await this.getDashboardByUid(uid);
    const model = new DashboardModel(fullDash.dashboard, fullDash.meta);

    if ((!fullDash.meta.folderId && toFolder.id === 0) || fullDash.meta.folderId === toFolder.id) {
      return { alreadyInFolder: true };
    }

    const clone = model.getSaveModelClone();
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
        const res = await fn(args);
        return Array.prototype.concat(result, [res]);
      } catch (err) {
        if (ignoreRejections) {
          return result;
        }

        throw err;
      }
    };
  }

  private executeInOrder(tasks: any[], initialValue: any[]) {
    return tasks.reduce(Promise.resolve, initialValue);
  }
}

coreModule.service('backendSrv', BackendSrv);
// Used for testing and things that really need BackendSrv
export const backendSrv = new BackendSrv();
export const getBackendSrv = (): BackendSrv => backendSrv;
