import { Observable } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { BackendSrv, BackendSrvRequest, FetchResponse } from '@grafana/runtime';

/**
 * Minimal mock implementation of BackendSrv for testing.
 * Only implements the fetch() method which is used by RTKQ.
 * HTTP requests are intercepted by MSW in tests.
 */
export class MockBackendSrv implements Partial<BackendSrv> {
  fetch<T>(options: BackendSrvRequest): Observable<FetchResponse<T>> {
    const init: RequestInit = {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.data ? JSON.stringify(options.data) : undefined,
      credentials: options.credentials,
      signal: options.abortSignal,
    };

    return new Observable((observer) => {
      fromFetch(options.url, init).subscribe({
        next: async (response) => {
          try {
            const data = await response.json();
            observer.next({
              data,
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              headers: response.headers,
              redirected: response.redirected,
              type: response.type,
              url: response.url,
              config: options,
            });
            observer.complete();
          } catch (error) {
            observer.error(error);
          }
        },
        error: (error) => observer.error(error),
      });
    });
  }
}
