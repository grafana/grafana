import { skipToken } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { OrphanedResourceBanner } from '../Shared/OrphanedResourceBanner';

interface Props {
  dashboard: DashboardScene;
}

export function OrphanedDashboardBanner({ dashboard }: Props) {
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();
  const uid = dashboard.state.uid ?? '';

  const shouldSkip = !config.featureToggles.provisioning || kind !== ManagerKind.Repo || !id;
  const { data: settingsData, isLoading } = useGetFrontendSettingsQuery(shouldSkip ? skipToken : undefined);

  if (shouldSkip || isLoading) {
    return null;
  }

  const items = settingsData?.items ?? [];
  const repoExists = items.some((repo) => repo.name === id);

  if (repoExists) {
    return null;
  }

  return <OrphanedResourceBanner uid={uid} resourceType="dashboards" />;
}
