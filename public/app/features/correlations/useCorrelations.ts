import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv, FetchResponse } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';

import {
  Correlation,
  CreateCorrelationParams,
  CreateCorrelationResponse,
  GetAllCorrelationsBySourceUIDParams,
  GetCorrelationsParams,
  RemoveCorrelationParams,
  RemoveCorrelationResponse,
  UpdateCorrelationParams,
  UpdateCorrelationResponse,
} from './types';

interface CorrelationsResponse {
  correlations: Correlation[];
  page: number;
  perPage: number;
  totalCount: number;
}

export interface CorrelationData extends Omit<Correlation, 'sourceUID' | 'targetUID'> {
  source: DataSourceInstanceSettings;
  target: DataSourceInstanceSettings;
}

interface CorrelationsData {
  correlations: CorrelationData[];
  page?: number;
  perPage?: number;
  totalCount?: number;
}

const toEnrichedCorrelationData = ({ sourceUID, targetUID, ...correlation }: Correlation): CorrelationData => ({
  ...correlation,
  source: getDataSourceSrv().getInstanceSettings(sourceUID)!,
  target: getDataSourceSrv().getInstanceSettings(targetUID)!,
});

const toEnrichedCorrelationsData = (correlationsResponse: CorrelationsResponse): CorrelationsData => {
  return {
    ...correlationsResponse,
    correlations: correlationsResponse.correlations.map(toEnrichedCorrelationData),
  };
};

const toNonPagedEnrichedCorrelationsData = (correlationsResponse: Correlation[]): CorrelationsData => {
  return {
    correlations: correlationsResponse.map(toEnrichedCorrelationData),
  };
};

function getData<T>(response: FetchResponse<T>) {
  return response.data;
}

/**
 * hook for managing correlations data.
 * TODO: ideally this hook shouldn't have any side effect like showing notifications on error
 * and let consumers handle them. It works nicely with the correlations settings page, but when we'll
 * expose this we'll have to remove those side effects.
 */
export const useCorrelations = () => {
  const { backend } = useGrafana();

  const [getInfo, get] = useAsyncFn<(params: GetCorrelationsParams) => Promise<CorrelationsData>>(
    (params) =>
      lastValueFrom(
        backend.fetch<CorrelationsResponse>({
          url: '/api/datasources/correlations',
          params: { page: params.page },
          method: 'GET',
          showErrorAlert: false,
        })
      )
        .then(getData)
        .then(toEnrichedCorrelationsData),
    [backend]
  );

  const [getAllFromSourceUIDInfo, getAllFromSourceUID] = useAsyncFn<
    (params: GetAllCorrelationsBySourceUIDParams) => Promise<CorrelationsData>
  >(
    (params) =>
      lastValueFrom(
        backend.fetch<Correlation[]>({
          url: `/api/datasources/uid/${params.sourceUID}/correlations`,
          method: 'GET',
          showErrorAlert: false,
        })
      )
        .then(getData)
        .then(toNonPagedEnrichedCorrelationsData),
    [backend]
  );

  const [createInfo, create] = useAsyncFn<(params: CreateCorrelationParams) => Promise<CorrelationData>>(
    ({ sourceUID, ...correlation }) =>
      backend
        .post<CreateCorrelationResponse>(`/api/datasources/uid/${sourceUID}/correlations`, correlation)
        .then((response) => {
          return toEnrichedCorrelationData(response.result);
        }),
    [backend]
  );

  const [removeInfo, remove] = useAsyncFn<(params: RemoveCorrelationParams) => Promise<{ message: string }>>(
    ({ sourceUID, uid }) =>
      backend.delete<RemoveCorrelationResponse>(`/api/datasources/uid/${sourceUID}/correlations/${uid}`),
    [backend]
  );

  const [updateInfo, update] = useAsyncFn<(params: UpdateCorrelationParams) => Promise<CorrelationData>>(
    ({ sourceUID, uid, ...correlation }) =>
      backend
        .patch<UpdateCorrelationResponse>(`/api/datasources/uid/${sourceUID}/correlations/${uid}`, correlation)
        .then((response) => toEnrichedCorrelationData(response.result)),
    [backend]
  );

  return {
    create: {
      execute: create,
      ...createInfo,
    },
    update: {
      execute: update,
      ...updateInfo,
    },
    get: {
      execute: get,
      ...getInfo,
    },
    getAllFromSourceUIDInfo: {
      execute: getAllFromSourceUID,
      ...getAllFromSourceUIDInfo,
    },
    remove: {
      execute: remove,
      ...removeInfo,
    },
  };
};
