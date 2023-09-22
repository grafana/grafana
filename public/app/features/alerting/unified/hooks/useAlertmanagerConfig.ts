import { SerializedError } from '@reduxjs/toolkit';

import { alertmanagerApi } from '../api/alertmanagerApi';

type Options = {
  refetchOnFocus: boolean;
  refetchOnReconnect: boolean;
};

// TODO refactor this so we can just call "alertmanagerApi.endpoints.getAlertmanagerConfiguration" everywhere
// and remove this hook since it adds little value
export function useAlertmanagerConfig(amSourceName?: string, options?: Options) {
  const fetchConfig = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useQuery(amSourceName ?? '', {
    ...options,
    skip: !amSourceName,
  });

  return {
    ...fetchConfig,
    // TODO refactor to get rid of this type assertion
    error: fetchConfig.error as SerializedError,
  };
}
