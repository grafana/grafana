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
    // we'll disable cache by default to prevent overwriting other changes made since last fetch
    refetchOnMountOrArgChange: true,
    ...options,
    skip: !amSourceName,
  });

  return {
    ...fetchConfig,
    // TODO refactor to get rid of this type assertion
    error: fetchConfig.error as SerializedError,
  };
}
