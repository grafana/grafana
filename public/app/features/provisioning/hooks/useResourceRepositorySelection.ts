import { skipToken } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';
import { type RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { isResourceKindAvailable, type ResourceKindInfo } from '../utils/resourceKinds';

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
 * Gates strictly on `availableResources` (passing `[]` rather than `undefined` so a not-yet-loaded
 * settings response doesn't fall back to "all kinds available").
 */
export function useResourceRepositorySelection(info: ResourceKindInfo): ResourceRepositorySelection {
  const provisioningEnabled = Boolean(config.featureToggles.provisioning);
  const { data } = useGetFrontendSettingsQuery(provisioningEnabled ? undefined : skipToken);

  // Non-folder-scoped kinds (e.g. playlists) can't live in a folder-target repository — they'd get a
  // `grafana.app/folder` annotation the backend rejects — so only offer instance/folderless repos.
  const repositories = (data?.items ?? []).filter((repo) => info.folderScoped || repo.target !== 'folder');
  const kindEnabled = isResourceKindAvailable(info, data?.availableResources ?? []);

  return {
    isAvailable: provisioningEnabled && kindEnabled && repositories.length > 0,
    repositories,
  };
}
