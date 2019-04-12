/**
 * Currently implemented with:
 * https://docs.angularjs.org/api/ng/service/$http#usage
 * but that will likely change in the future
 */
export type BackendSrvRequest = {
  url: string;
  retry?: number;
  headers?: any;
  method?: string;

  // Show a message with the result
  showSuccessAlert?: boolean;

  [key: string]: any;
};

export interface BackendSrv {
  get(url: string, params?: any): Promise<any>;

  delete(url: string): Promise<any>;

  post(url: string, data: any): Promise<any>;

  patch(url: string, data: any): Promise<any>;

  put(url: string, data: any): Promise<any>;

  // If there is an error, set: err.isHandled = true
  // otherwise the backend will show a message for you
  request(options: BackendSrvRequest): Promise<any>;
}

let singletonInstance: BackendSrv;

export function setBackendSrv(instance: BackendSrv) {
  singletonInstance = instance;
}

export function getBackendSrv(): BackendSrv {
  return singletonInstance;
}
