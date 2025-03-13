import { BaseQueryFn } from '@reduxjs/toolkit/query';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv, isFetchError } from '@grafana/runtime';

interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  body?: BackendSrvRequest['data'];
}

interface CreateBaseQueryOptions {
  baseURL: string;
}

export function createBaseQuery({ baseURL }: CreateBaseQueryOptions): BaseQueryFn<RequestOptions> {
  async function backendSrvBaseQuery(requestOptions: RequestOptions) {
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
  if (isFetchError(error)) {
    return { error };
  } else if (error instanceof Error) {
    return { error: { message: error } };
  } else {
    return { error: { message: new Error('Unknown error') } };
  }
}
