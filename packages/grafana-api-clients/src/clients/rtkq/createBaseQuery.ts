import { BaseQueryFn } from '@reduxjs/toolkit/query';
import { lastValueFrom } from 'rxjs';

import { type BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

import { handleRequestError } from '../../utils/utils';

export interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  body?: BackendSrvRequest['data'];
}

interface CreateBaseQueryOptions {
  baseURL: string;
}

export function createBaseQuery({ baseURL }: CreateBaseQueryOptions): BaseQueryFn<RequestOptions> {
  async function backendSrvBaseQuery(requestOptions: RequestOptions) {
    try {
      const headers: Record<string, string> = {
        ...requestOptions.headers,
      };

      // Add Content-Type header for PATCH requests to /apis/ endpoints if not already set
      if (
        requestOptions.method?.toUpperCase() === 'PATCH' &&
        baseURL?.startsWith('/apis/') &&
        !headers['Content-Type']
      ) {
        headers['Content-Type'] = 'application/strategic-merge-patch+json';
      }

      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseURL + requestOptions.url,
          showErrorAlert: requestOptions.showErrorAlert ?? false,
          data: requestOptions.body,
          headers,
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
