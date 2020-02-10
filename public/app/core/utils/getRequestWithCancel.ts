import { getBackendSrv } from '@grafana/runtime';

export interface GetRequestWithCancel {
  url: string;
  params: any;
  requestId: string;
}

export interface GetRequestWithCancelDependencies {
  getBackendSrv: typeof getBackendSrv;
}

export const getRequestWithCancel = async <T>(
  { url, requestId, params }: GetRequestWithCancel,
  dependencies: GetRequestWithCancelDependencies = { getBackendSrv: getBackendSrv }
): Promise<T[]> => {
  try {
    const response: { data: T[] } = await dependencies.getBackendSrv().datasourceRequest({ url, requestId, params });
    return response.data;
  } catch (err) {
    if (err.cancelled) {
      return [];
    }
    throw err;
  }
};
