/**
 * Templates for clients generated outside this repository, i.e. in an app plugin.
 * They import from @grafana/api-clients rather than from relative paths in this package;
 * see ../generator/templates.ts for the in-repo equivalents.
 */

/** lowerCamel reducer path from a group and version, e.g. `appsdktestExtAPIv1alpha1`. */
export function reducerPath(group: string, version: string): string {
  const label = group.replace(/\.grafana\.app$/, '');
  return (
    label
      .split('.')
      .filter(Boolean)
      .map((part, i) => (i === 0 ? part : part[0].toUpperCase() + part.slice(1)))
      .join('') +
    'API' +
    version
  );
}

export function renderPluginBaseAPI(group: string, version: string): string {
  return `import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL } from '@grafana/api-clients';

import { createBaseQuery } from '../createBaseQuery';

export const API_GROUP = '${group}' as const;
export const API_VERSION = '${version}' as const;
export const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const api = createApi({
  reducerPath: '${reducerPath(group, version)}',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
`;
}

export function renderPluginIndexTs(): string {
  return `export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
import { generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({});
`;
}

/** Same as ../clients/rtkq/createBaseQuery.ts, importing its helper from the published package. */
export const CREATE_BASE_QUERY_SOURCE = `import { type BaseQueryFn } from '@reduxjs/toolkit/query';
import { lastValueFrom } from 'rxjs';

import { handleRequestError } from '@grafana/api-clients';
import { type BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

export interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  body?: BackendSrvRequest['data'];
}

export type CreateBaseQueryOptions = { baseURL: string } | { getBaseURL: () => Promise<string> };

export function createBaseQuery(options: CreateBaseQueryOptions): BaseQueryFn<RequestOptions> {
  const resolveBaseURL = 'getBaseURL' in options ? options.getBaseURL : () => Promise.resolve(options.baseURL);

  async function backendSrvBaseQuery(requestOptions: RequestOptions) {
    try {
      const baseURL = await resolveBaseURL();
      const headers: Record<string, string> = {
        ...requestOptions.headers,
      };

      if (requestOptions.method?.toUpperCase() === 'PATCH' && baseURL.startsWith('/apis/')) {
        // If we're trying to do some \`json-patch\` operation, set Content-Type header accordingly
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
`;
