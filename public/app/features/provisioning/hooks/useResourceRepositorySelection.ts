import { skipToken } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';
import { type KindInfo } from '@grafana/runtime/unstable';
import { type RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { isResourceKindAvailable } from '../utils/resourceKinds';

export interface ResourceRepositorySelection {
  /**
   * Whether a resource of this kind can be saved to a repository: provisioning is enabled, the kind
   * is declared (and not disabled) in the settings endpoint's `availableResources`, and at least one
   * repository is configured.
   */
  isAvailable: boolean;
  /** Configured repositories the resource can be committed to. */
  repositories: RepositoryView[];
}

/**
 * Resolves whether a resource of the given kind can be committed to a repository, and the
 * repositories available for it. Use this to gate a repository selector on a resource's
 * create/edit surface (playlists, etc.).
 *
 * Gates strictly on `availableResources`: until the settings load, no kind is available.
 */
export function useResourceRepositorySelection(info: KindInfo): ResourceRepositorySelection {
  const provisioningEnabled = Boolean(config.provisioningEnabled);
  const { data } = useGetFrontendSettingsQuery(provisioningEnabled ? undefined : skipToken);

  const repositories = data?.items ?? [];
  const kindEnabled = isResourceKindAvailable(info, data?.availableResources ?? []);

  return {
    isAvailable: provisioningEnabled && kindEnabled && repositories.length > 0,
    repositories,
  };
}
