import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';
import { RepositoryViewList, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

export function useIsProvisionedInstance(settings?: RepositoryViewList) {
  const settingsQuery = useGetFrontendSettingsQuery(
    settings || !config.featureToggles.provisioning ? skipToken : undefined
  );
  if (!settings) {
    settings = settingsQuery.data;
  }
  return settings?.items?.some((item) => item.target === 'instance');
}
