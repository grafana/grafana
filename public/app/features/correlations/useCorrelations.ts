import { useCallback, useEffect, useState } from 'react';
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

  const getCorrelations = useCallback(() => {
    return lastValueFrom(
      backend.fetch<Correlation[]>({ url: '/api/datasources/correlations', method: 'GET', showErrorAlert: false })
    )
      .then(getData, (e) => {
        setError(e);
        return [];
      })
      .then(toEnrichedCorrelationsData);
  }, [backend]);

  const [{ value: correlations, loading }, reload] = useAsyncFn(getCorrelations, [getCorrelations]);

  useEffect(() => {
    reload();
    // we only want to fetch data on first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = ({ sourceUID, ...correlation }: CreateCorrelationParams) => {
    return backend.post(`/api/datasources/uid/${sourceUID}/correlations`, correlation).then((data) => {
      reload();
      return toEnrichedCorrelationData(data);
    });
  };

  const remove = ({ sourceUID, uid }: RemoveCorrelationParams) => {
    return backend.delete(`/api/datasources/uid/${sourceUID}/correlations/${uid}`).then(reload);
  };

  const update = ({ sourceUID, uid, ...correlation }: UpdateCorrelationParams) => {
    return backend.patch(`/api/datasources/uid/${sourceUID}/correlations/${uid}`, correlation).then((data) => {
      reload();
      return toEnrichedCorrelationData(data);
    });
  };

  return { correlations, create, update, reload, remove, isLoading: loading, error };
};
