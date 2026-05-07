import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';
import { type RepositoryViewList, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

interface UseIsProvisionedInstanceOptions {
  settings?: RepositoryViewList;
  skip?: boolean;
}

export function useIsProvisionedInstance(options: UseIsProvisionedInstanceOptions = {}) {
  const { settings, skip: skipQuery } = options;
  const skip = !config.featureToggles.provisioning || skipQuery;

  const settingsQuery = useGetFrontendSettingsQuery(settings || skip ? skipToken : undefined);

  if (settingsQuery.isError) {
    return false;
  }

  const effectiveSettings = settings ?? settingsQuery.data;
  return effectiveSettings?.items?.some((item) => item.target === 'instance');
}
