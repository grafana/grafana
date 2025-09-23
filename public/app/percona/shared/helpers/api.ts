/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import axios, { CancelToken, AxiosInstance, AxiosRequestConfig } from 'axios';

import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';

import { ApiError, ApiErrorCode, ApiParamBody, ApiParams, ApiVerboseError } from '../core';

export class ApiRequest {
  axiosInstance: AxiosInstance;

  constructor(params: object) {
    this.axiosInstance = axios.create({
      ...params,
    });
  }

  async get<T, B>(
    path: string,
    disableNotifications = false,
    query?: { params?: B; cancelToken?: CancelToken }
  ): Promise<T> {
    return this.axiosInstance
      .get<T>(path, query)
      .then((response): T => response.data)
      .catch((e) => {
        if (!disableNotifications && !axios.isCancel(e)) {
          appEvents.emit(AppEvents.alertError, [e.message]);
        }
        throw e;
      });
  }

  async post<T, B = any>(
    path: string,
    body: B,
    disableNotifications = false,
    cancelToken?: CancelToken,
    params?: AxiosRequestConfig<B>['params']
  ): Promise<T> {
    return this.axiosInstance
      .post<T>(path, body, { cancelToken, params })
      .then((response): T => response.data)
      .catch((e) => {
        if (!disableNotifications && !axios.isCancel(e)) {
          appEvents.emit(AppEvents.alertError, [e.response.data?.message ?? 'Unknown error']);
        }

        throw e;
      });
  }

  async delete<T, B = any>(
    path: string,
    disableNotifications = false,
    cancelToken?: CancelToken,
    params?: AxiosRequestConfig<B>['params']
  ): Promise<T> {
    return this.axiosInstance
      .delete<T>(path, { cancelToken, params })
      .then((response): T => response.data)
      .catch((e) => {
        if (!disableNotifications) {
          appEvents.emit(AppEvents.alertError, [e.response.data?.message ?? 'Unknown error']);
        }
        throw e;
      });
  }

  async patch<T, B>(path: string, body: B, disableNotifications = false, cancelToken?: CancelToken): Promise<T> {
    return this.axiosInstance
      .patch<T>(path, body, { cancelToken })
      .then((response): T => response.data)
      .catch((e) => {
        if (!disableNotifications) {
          appEvents.emit(AppEvents.alertError, [e.response.data?.message ?? 'Unknown error']);
        }
        throw e;
      });
  }

  async put<T, B>(path: string, body: B, disableNotifications = false, cancelToken?: CancelToken): Promise<T> {
    return this.axiosInstance
      .put<T>(path, body, { cancelToken })
      .then((response): T => response.data)
      .catch((e) => {
        if (!disableNotifications) {
          appEvents.emit(AppEvents.alertError, [e.response.data?.message ?? 'Unknown error']);
        }
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

export const translateApiError = (error: ApiErrorCode): ApiVerboseError | undefined => {
  const map: Record<ApiErrorCode, ApiVerboseError> = {
    [ApiErrorCode.ERROR_CODE_INVALID_XTRABACKUP]: {
      message: 'Different versions of xtrabackup and xbcloud.',
      link: '',
    },
    [ApiErrorCode.ERROR_CODE_XTRABACKUP_NOT_INSTALLED]: {
      message: 'Xtrabackup is not installed.',
      link: 'https://per.co.na/install_pxb',
    },
    [ApiErrorCode.ERROR_CODE_INCOMPATIBLE_XTRABACKUP]: {
      message: 'Xtrabackup version is not compatible.',
      link: 'https://per.co.na/install_pxb',
    },
    [ApiErrorCode.ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL]: {
      message: 'Target MySQL version is not compatible.',
      link: 'https://per.co.na/install_pxb',
    },
  };

  const translatedError = map[error];

  return translatedError;
};

export const apiErrorParser = (e: any): ApiVerboseError[] => {
  const errorData: ApiError = e.response?.data as ApiError;
  let result: ApiVerboseError[] = [];

  if (errorData) {
    const { details = [] } = errorData;

    result = details.reduce((acc, current) => {
      const translatedError = translateApiError(current.code);
      return translatedError ? [...acc, translatedError] : acc;
    }, [] as ApiVerboseError[]);
  }

  return result;
};

export const getApiFilterParams = (params: ApiParamBody[]): ApiParams => {
  const resultParams: ApiParams = { filter_params: {} };

  params.forEach((param) => {
    for (const [key, { intValues = [], longValues = [], stringValues = [] }] of Object.entries(param)) {
      resultParams.filter_params[key] = {
        int_values: { values: intValues },
        long_values: { values: longValues },
        string_values: { values: stringValues },
      };
    }
  });

  return resultParams;
};
