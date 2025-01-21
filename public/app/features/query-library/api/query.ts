import { BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { config } from '@grafana/runtime';
import { BackendSrvRequest, getBackendSrv, isFetchError } from '@grafana/runtime/src/services/backendSrv';

/**
 * @alpha
 */
export const API_VERSION = 'peakq.grafana.app/v0alpha1';

/**
 * @alpha
 */
export enum QueryTemplateKinds {
  QueryTemplate = 'QueryTemplate',
}

/**
 * Query Library is an experimental feature. API (including the URL path) will likely change.
 *
 * @alpha
 */
export const BASE_URL = `/apis/${API_VERSION}/namespaces/${config.namespace}/querytemplates`;

// URL is optional for these requests
interface QueryLibraryBackendRequest extends Pick<BackendSrvRequest, 'data' | 'method'> {
  url?: string;
  headers?: { [key: string]: string };
  body?: BackendSrvRequest['data'];
}

export const baseQuery: BaseQueryFn<QueryLibraryBackendRequest, unknown, Error> = async (requestOptions) => {
  try {
    const responseObservable = getBackendSrv().fetch({
      url: `${requestOptions.url ?? ''}`,
      showErrorAlert: true,
      method: requestOptions.method || 'GET',
      data: requestOptions.body,
      headers: { ...requestOptions.headers },
    });
    return await lastValueFrom(responseObservable);
  } catch (error) {
    if (isFetchError(error)) {
      return { error: new Error(error.data.message) };
    } else if (error instanceof Error) {
      return { error };
    } else {
      return { error: new Error('Unknown error') };
    }
  }
};
