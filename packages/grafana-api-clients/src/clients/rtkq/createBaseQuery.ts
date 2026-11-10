import { type BaseQueryFn } from '@reduxjs/toolkit/query';
import { lastValueFrom } from 'rxjs';

import { type BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

import { handleRequestError } from '../../utils/utils';

export interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  body?: BackendSrvRequest['data'];
}

export type CreateBaseQueryOptions = { baseURL: string } | { getBaseURL: () => Promise<string> };

export function createBaseQuery(options: CreateBaseQueryOptions): BaseQueryFn<RequestOptions> {
  // Get the correct resolver once for all API calls
  const resolveBaseURL = 'getBaseURL' in options ? options.getBaseURL : () => Promise.resolve(options.baseURL);

  async function backendSrvBaseQuery(requestOptions: RequestOptions) {
    try {
      const baseURL = await resolveBaseURL();
      const headers: Record<string, string> = {
        ...requestOptions.headers,
      };

      if (requestOptions.method?.toUpperCase() === 'PATCH' && baseURL.startsWith('/apis/')) {
        // If we're trying to do some `json-patch` operation, set Content-Type header accordingly
        if (requestOptions.body && Array.isArray(requestOptions.body) && requestOptions.body.some((item) => item.op)) {
          headers['Content-Type'] = 'application/json-patch+json';
        }

        // Add Content-Type header if not already set
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/strategic-merge-patch+json';
        }
      }

      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseURL + requestOptions.url,
          // Default to GET so backend_srv correctly skips success alerts for queries
          method: requestOptions.method ?? 'GET',
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
