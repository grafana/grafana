import { SerializedError } from '@reduxjs/toolkit';
import { useEffect } from 'react';

import { alertmanagerApi } from '../api/alertmanagerApi';

type Options = {
  refetchOnFocus?: boolean;
  refetchOnReconnect?: boolean;
};

// TODO refactor this so we can just call "alertmanagerApi.endpoints.getAlertmanagerConfiguration" everywhere
// and remove this hook since it adds little value
export function useAlertmanagerConfig(amSourceName?: string, options?: Options) {
  const [fetchConfig, fetchState] = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useLazyQuery(options);

  useEffect(() => {
    if (amSourceName) {
      fetchConfig(amSourceName);
    }
  }, [amSourceName, fetchConfig]);

  return {
    result: fetchState.data,
    config: fetchState.data?.alertmanager_config,
    loading: fetchState.isLoading,
    error: fetchState.error as SerializedError,
  };
}
