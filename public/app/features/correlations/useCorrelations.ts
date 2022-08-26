import { useState } from 'react';
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv, FetchResponse, FetchError } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { Correlation, CreateCorrelationParams, RemoveCorrelationParams, UpdateCorrelationParams } from './types';

export interface CorrelationData extends Omit<Correlation, 'sourceUID' | 'targetUID'> {
  source: DataSourceInstanceSettings;
  target: DataSourceInstanceSettings;
}

const toEnrichedCorrelationData = ({ sourceUID, targetUID, ...correlation }: Correlation): CorrelationData => ({
  ...correlation,
  source: getDataSourceSrv().getInstanceSettings(sourceUID)!,
  target: getDataSourceSrv().getInstanceSettings(targetUID)!,
});

const toEnrichedCorrelationsData = (correlations: Correlation[]) => correlations.map(toEnrichedCorrelationData);
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
  const [error, setError] = useState<FetchError | null>(null);

  const [getInfo, get] = useAsyncFn<() => Promise<CorrelationData[]>>(
    () =>
      lastValueFrom(
        backend.fetch<Correlation[]>({ url: '/api/datasources/correlations', method: 'GET', showErrorAlert: false })
      )
        .then(getData, (e) => {
          setError(e);
          return [];
        })
        .then(toEnrichedCorrelationsData),
    [backend]
  );

  const [createInfo, create] = useAsyncFn<(params: CreateCorrelationParams) => Promise<CorrelationData>>(
    ({ sourceUID, ...correlation }) =>
      backend.post(`/api/datasources/uid/${sourceUID}/correlations`, correlation).then(toEnrichedCorrelationData),
    [backend]
  );

  const [removeInfo, remove] = useAsyncFn<(params: RemoveCorrelationParams) => Promise<void>>(
    ({ sourceUID, uid }) => backend.delete(`/api/datasources/uid/${sourceUID}/correlations/${uid}`),
    [backend]
  );

  const [updateInfo, update] = useAsyncFn<(params: UpdateCorrelationParams) => Promise<CorrelationData>>(
    ({ sourceUID, uid, ...correlation }) =>
      backend
        .patch(`/api/datasources/uid/${sourceUID}/correlations/${uid}`, correlation)
        .then(toEnrichedCorrelationData),
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
      error,
    },
    remove: {
      execute: remove,
      ...removeInfo,
    },
  };
};
