import { BaseQueryFn } from '@reduxjs/toolkit/query';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv, isFetchError } from '@grafana/runtime';

interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  body?: BackendSrvRequest['data'];
}

export function createBaseQuery({ baseURL }: { baseURL: string }): BaseQueryFn<RequestOptions> {
  async function backendSrvBaseQuery(requestOptions: RequestOptions) {
    let url = baseURL + requestOptions.url;
    try {
      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseURL + requestOptions.url,
          showErrorAlert: requestOptions.showErrorAlert ?? false,
          data: requestOptions.body,
        })
      );
      return { data: responseData, meta };
    } catch (error) {
      console.log('backendSrvBaseQuery catch', {
        error,
        url,
        method: requestOptions?.method,
        requestId: requestOptions?.requestId,
        body: requestOptions?.body,
      });

      if (requestOptions.manageError) {
        return requestOptions.manageError(error);
      } else {
        return handleRequestError(error);
      }
    }
  }

  return backendSrvBaseQuery;
}

export function handleRequestError(error: unknown) {
  console.log('handleRequestError', { error });

  if (isFetchError(error)) {
    return { error: new RequestError(error.data.message, error.status) };
  } else if (error instanceof Error) {
    return { error };
  } else {
    return { error: new Error('Unknown error') };
  }
}

export class RequestError extends Error {
  private readonly _statusCode: number;

  constructor(message: string, statusCode: number, options?: ErrorOptions) {
    super(message, options);
    this._statusCode = statusCode;
  }

  public get statusCode() {
    return this._statusCode;
  }
}
