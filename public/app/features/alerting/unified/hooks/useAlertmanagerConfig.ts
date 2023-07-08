import { SerializedError } from '@reduxjs/toolkit';
import { useEffect } from 'react';

import { alertmanagerApi } from '../api/alertmanagerApi';

// TODO refactor this so we can just call "alertmanagerApi.endpoints.getAlertmanagerConfiguration" everywhere
// and remove this hook
export function useAlertmanagerConfig(amSourceName?: string) {
  const [fetchConfig, fetchState] = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useLazyQuery();

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
