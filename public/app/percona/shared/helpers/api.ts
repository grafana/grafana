import axios, { CancelToken, AxiosInstance } from 'axios';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';

export class ApiRequest {
  axiosInstance: AxiosInstance;

  constructor(params: object) {
    this.axiosInstance = axios.create({
      ...params,
    });
  }

  async get<T, B>(path: string, query?: { params: B; cancelToken?: CancelToken }): Promise<T> {
    return this.axiosInstance
      .get<T>(path, query)
      .then((response): T => response.data)
      .catch((e) => {
        appEvents.emit(AppEvents.alertError, [e.message]);
        throw e;
      });
  }

  async post<T, B>(path: string, body: B, disableNotifications = false, cancelToken?: CancelToken): Promise<T> {
    return this.axiosInstance
      .post<T>(path, body, { cancelToken })
      .then((response): T => response.data)
      .catch((e) => {
        if (!disableNotifications && !axios.isCancel(e)) {
          appEvents.emit(AppEvents.alertError, [e.response.data?.message ?? 'Unknown error']);
        }

        throw e;
      });
  }

  async delete<T>(path: string): Promise<T> {
    return this.axiosInstance
      .delete<T>(path)
      .then((response): T => response.data)
      .catch((e) => {
        // Notify.error(e.message);
        throw e;
      });
  }

  async patch<T, B>(path: string, body: B): Promise<T> {
    return this.axiosInstance
      .patch<T>(path, body)
      .then((response): T => response.data)
      .catch((e) => {
        // Notify.error(e.message);
        throw e;
      });
  }
}

export const api = new ApiRequest({});
export const apiQAN = new ApiRequest({ baseURL: '/v0/qan' });
export const apiManagement = new ApiRequest({ baseURL: '/v1/management' });
export const apiInventory = new ApiRequest({ baseURL: '/v1/inventory' });
export const apiSettings = new ApiRequest({ baseURL: '/v1/Settings' });
export const isApiCancelError = (e: any) => axios.isCancel(e);
