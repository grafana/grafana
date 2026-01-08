import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { getDataSourceSrv, FetchResponse, CorrelationData, CorrelationsData } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';

import {
  Correlation,
  CreateCorrelationParams,
  CreateCorrelationResponse,
  GetCorrelationsParams,
  RemoveCorrelationParams,
  RemoveCorrelationResponse,
  UpdateCorrelationParams,
  UpdateCorrelationResponse,
} from './types';
import { correlationsLogger } from './utils';

export interface CorrelationsResponse {
  correlations: Correlation[];
  page: number;
  limit: number;
  totalCount: number;
}

const toEnrichedCorrelationData = ({ sourceUID, ...correlation }: Correlation): CorrelationData | undefined => {
  const sourceDatasource = getDataSourceSrv().getInstanceSettings(sourceUID);
  const targetDatasource =
    correlation.type === 'query' ? getDataSourceSrv().getInstanceSettings(correlation.targetUID) : undefined;

  // According to #72258 we will remove logic to handle orgId=0/null as global correlations.
  // This logging is to check if there are any customers who did not migrate existing correlations.
  // See Deprecation Notice in https://github.com/grafana/grafana/pull/72258 for more details
  if (correlation?.orgId === undefined || correlation?.orgId === null || correlation?.orgId === 0) {
    correlationsLogger.logWarning('Invalid correlation config: Missing org id.');
  }

  if (
    sourceDatasource &&
    sourceDatasource?.uid !== undefined &&
    targetDatasource?.uid !== undefined &&
    correlation.type === 'query'
  ) {
    return {
      ...correlation,
      source: sourceDatasource,
      target: targetDatasource,
    };
  }

  if (
    sourceDatasource &&
    sourceDatasource?.uid !== undefined &&
    targetDatasource?.uid === undefined &&
    correlation.type === 'external'
  ) {
    return {
      ...correlation,
      source: sourceDatasource,
    };
  }

  correlationsLogger.logWarning(`Invalid correlation config: Missing source or target.`, {
    source: JSON.stringify(sourceDatasource),
    target: JSON.stringify(targetDatasource),
  });
  return undefined;
};

const validSourceFilter = (correlation: CorrelationData | undefined): correlation is CorrelationData => !!correlation;

export const toEnrichedCorrelationsData = (correlationsResponse: CorrelationsResponse): CorrelationsData => {
  return {
    ...correlationsResponse,
    correlations: correlationsResponse.correlations.map(toEnrichedCorrelationData).filter(validSourceFilter),
  };
};

export function getData<T>(response: FetchResponse<T>) {
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

  const [createInfo, create] = useAsyncFn<(params: CreateCorrelationParams) => Promise<CorrelationData>>(
    ({ sourceUID, ...correlation }) =>
      backend
        .post<CreateCorrelationResponse>(`/api/datasources/uid/${sourceUID}/correlations`, correlation)
        .then((response) => {
          const enrichedCorrelation = toEnrichedCorrelationData(response.result);
          if (enrichedCorrelation !== undefined) {
            return enrichedCorrelation;
          } else {
            throw new Error('invalid sourceUID');
          }
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
        .then((response) => {
          const enrichedCorrelation = toEnrichedCorrelationData(response.result);
          if (enrichedCorrelation !== undefined) {
            return enrichedCorrelation;
          } else {
            throw new Error('invalid sourceUID');
          }
        }),
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
    remove: {
      execute: remove,
      ...removeInfo,
    },
  };
};
