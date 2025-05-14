import { Observable } from 'rxjs';

/**
 * Used to initiate a remote call via the {@link BackendSrv}
 *
 * @public
 */
export type BackendSrvRequest = {
  /**
   * Request URL
   */
  url: string;

  /**
   * Number of times to retry the remote call if it fails.
   */
  retry?: number;

  /**
   * HTTP headers that should be passed along with the remote call.
   * Please have a look at {@link https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API | Fetch API}
   * for supported headers.
   */
  headers?: Record<string, any>;

  /**
   * HTTP verb to perform in the remote call GET, POST, PUT etc.
   */
  method?: string;

  /**
   * Set to false an success application alert box will not be shown for successful PUT, DELETE, POST requests
   */
  showSuccessAlert?: boolean;

  /**
   * Set to false to not show an application alert box for request errors
   */
  showErrorAlert?: boolean;

  /**
   * Provided by the initiator to identify a particular remote call. An example
   * of this is when a datasource plugin triggers a query. If the request id already
   * exist the backendSrv will try to cancel and replace the previous call with the
   * new one.
   */
  requestId?: string;

  /**
   * Set to to true to not include call in query inspector
   */
  hideFromInspector?: boolean;

  /**
   * The data to send
   */
  data?: any;

  /**
   * Query params
   */
  params?: Record<string, any>;

  /**
   * Define how the response object should be parsed.  See:
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Sending_and_Receiving_Binary_Data
   *
   * By default values are json parsed from text
   */
  responseType?: 'json' | 'text' | 'arraybuffer' | 'blob';

  /**
   * Used to cancel an open connection
   * https://developer.mozilla.org/en-US/docs/Web/API/AbortController
   */
  abortSignal?: AbortSignal;

  /**
   * The credentials read-only property of the Request interface indicates whether the user agent should send cookies from the other domain in the case of cross-origin requests.
   */
  credentials?: RequestCredentials;

  /**
   * @deprecated withCredentials is deprecated in favor of credentials
   */
  withCredentials?: boolean;
};

/**
 * Response for fetch function in {@link BackendSrv}
 *
 * @public
 */
export interface FetchResponse<T = any> {
  data: T;
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly redirected: boolean;
  readonly type: ResponseType;
  readonly url: string;
  readonly config: BackendSrvRequest;
  readonly traceId?: string;
}

/**
 * Error type for fetch function in {@link BackendSrv}
 *
 * @public
 */
export interface FetchErrorDataProps {
  message?: string;
  status?: string;
  error?: string | any;
}

/**
 * Error type for fetch function in {@link BackendSrv}
 *
 * @public
 */
export interface FetchError<T = any> {
  status: number;
  statusText?: string;
  data: T;
  message?: string;
  cancelled?: boolean;
  isHandled?: boolean;
  config: BackendSrvRequest;
  traceId?: string;
}

export function isFetchError<T = any>(e: unknown): e is FetchError<T> {
  return typeof e === 'object' && e !== null && 'status' in e && 'data' in e;
}

/**
 * Used to communicate via http(s) to a remote backend such as the Grafana backend,
 * a datasource etc. The BackendSrv is using the {@link https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API | Fetch API}
 * under the hood to handle all the communication.
 *
 * The request function can be used to perform a remote call by specifying a {@link BackendSrvRequest}.
 * To make the BackendSrv a bit easier to use we have added a couple of shorthand functions that will
 * use default values executing the request.
 *
 * @remarks
 * By default, Grafana displays an error message alert if the remote call fails. To prevent this from
 * happening `showErrorAlert = true` on the options object.
 *
 * @public
 */
export interface BackendSrv {
  get<T = any>(url: string, params?: any, requestId?: string, options?: Partial<BackendSrvRequest>): Promise<T>;
  delete<T = unknown>(url: string, data?: unknown, options?: Partial<BackendSrvRequest>): Promise<T>;
  post<T = any>(url: string, data?: unknown, options?: Partial<BackendSrvRequest>): Promise<T>;
  patch<T = any>(url: string, data?: unknown, options?: Partial<BackendSrvRequest>): Promise<T>;
  put<T = any>(url: string, data?: unknown, options?: Partial<BackendSrvRequest>): Promise<T>;

  /**
   * @deprecated Use the `.fetch()` function instead. If you prefer to work with a promise
   * wrap the Observable returned by fetch with the lastValueFrom function, or use the get|delete|post|patch|put methods.
   * This method is going to be private from Grafana 10.
   */
  request<T = unknown>(options: BackendSrvRequest): Promise<T>;

  /**
   * Special function used to communicate with datasources that will emit core
   * events that the Grafana QueryInspector and QueryEditor is listening for to be able
   * to display datasource query information. Can be skipped by adding `option.silent`
   * when initializing the request.
   *
   * @deprecated Use the fetch function instead
   */
  datasourceRequest<T = unknown>(options: BackendSrvRequest): Promise<FetchResponse<T>>;

  /**
   * Observable http request interface
   */
  fetch<T>(options: BackendSrvRequest): Observable<FetchResponse<T>>;

  /**
   * Observe each raw chunk in the response.  This is useful when reading values from
   * a long living HTTP connection like the kubernetes WATCH command.
   *
   * Each chunk includes the full response headers and the `data` property is filled with the chunk.
   */
  chunked(options: BackendSrvRequest): Observable<FetchResponse<Uint8Array | undefined>>;
}

let singletonInstance: BackendSrv;

/**
 * Used during startup by Grafana to set the BackendSrv so it is available
 * via the {@link getBackendSrv} to the rest of the application.
 *
 * @internal
 */
export const setBackendSrv = (instance: BackendSrv) => {
  singletonInstance = instance;
};

/**
 * Used to retrieve the {@link BackendSrv} that can be used to communicate
 * via http(s) to a remote backend such as the Grafana backend, a datasource etc.
 *
 * @public
 */
export const getBackendSrv = (): BackendSrv => singletonInstance;
