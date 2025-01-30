import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv, isFetchError } from '@grafana/runtime';

interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  showErrorAlert?: boolean;
  body?: BackendSrvRequest['data'];
}

export function createBaseQuery({ baseURL }: { baseURL: string }) {
  async function backendSrvBaseQuery(requestOptions: RequestOptions) {
    try {
      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseURL + requestOptions.url,
          showErrorAlert: requestOptions.showErrorAlert,
          data: requestOptions.body,
        })
      );
      return { data: responseData, meta };
    } catch (error) {
      if (isFetchError(error)) {
        return { error: new Error(error.data.message) };
      } else if (error instanceof Error) {
        return { error };
      } else {
        return { error: new Error('Unknown error') };
      }
    }
  }

  return backendSrvBaseQuery;
}
