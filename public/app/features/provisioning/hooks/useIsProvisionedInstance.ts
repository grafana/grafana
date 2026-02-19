import { skipToken } from '@reduxjs/toolkit/query';

import { OrgRole } from '@grafana/data';
import { config } from '@grafana/runtime';
import { RepositoryViewList, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';

interface UseIsProvisionedInstanceOptions {
  settings?: RepositoryViewList;
  skip?: boolean;
}

export function useIsProvisionedInstance(options: UseIsProvisionedInstanceOptions = {}) {
  const { settings, skip: skipQuery } = options;
  const hasNoRole = contextSrv.user.orgRole === OrgRole.None;
  const skip = !config.featureToggles.provisioning || hasNoRole || skipQuery;

  const settingsQuery = useGetFrontendSettingsQuery(settings || skip ? skipToken : undefined);

  if (settingsQuery.isError) {
    return false;
  }

  const effectiveSettings = settings ?? settingsQuery.data;
  return effectiveSettings?.items?.some((item) => item.target === 'instance');
}
