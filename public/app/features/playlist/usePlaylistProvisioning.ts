import { skipToken } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';
import { type RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { isResourceKindAvailable, resourceKindInfos } from 'app/features/provisioning/utils/resourceKinds';

export interface PlaylistProvisioning {
  /**
   * Whether the repository selector should be offered: provisioning is enabled, the playlist kind
   * is declared (and not disabled) in the settings endpoint's `availableResources`, and at least
   * one repository is configured.
   */
  isAvailable: boolean;
  /** Configured repositories the playlist can be committed to. */
  repositories: RepositoryView[];
}

/**
 * Resolves whether a playlist can be saved to a repository, and the repositories available for it.
 * Gates strictly on `availableResources` (passing `[]` rather than `undefined` so a not-yet-loaded
 * settings response doesn't fall back to "all kinds available").
 */
export function usePlaylistProvisioning(): PlaylistProvisioning {
  const provisioningEnabled = Boolean(config.featureToggles.provisioning);
  const { data } = useGetFrontendSettingsQuery(provisioningEnabled ? undefined : skipToken);

  const repositories = data?.items ?? [];
  const playlistEnabled = isResourceKindAvailable(resourceKindInfos.playlist, data?.availableResources ?? []);

  return {
    isAvailable: provisioningEnabled && playlistEnabled && repositories.length > 0,
    repositories,
  };
}
