import { skipToken } from '@reduxjs/toolkit/query';

import { RepositoryViewList, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';

export function useIsProvisionedInstance(settings?: RepositoryViewList) {
  const settingsQuery = useGetFrontendSettingsQuery(settings ? skipToken : undefined);
  if (!settings) {
    settings = settingsQuery.data;
  }
  return settings?.items?.some((item) => item.target === 'instance');
}
