import { skipToken } from '@reduxjs/toolkit/query';

import { OrgRole } from '@grafana/data';
import { config } from '@grafana/runtime';
import { RepositoryViewList, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/core';

export function useIsProvisionedInstance(settings?: RepositoryViewList) {
  const hasNoRole = contextSrv.user.orgRole === OrgRole.None;
  const skip = !config.featureToggles.provisioning || hasNoRole;

  const settingsQuery = useGetFrontendSettingsQuery(settings || skip ? skipToken : undefined);
  if (!settings) {
    settings = settingsQuery.data;
  }
  return settings?.items?.some((item) => item.target === 'instance');
}
