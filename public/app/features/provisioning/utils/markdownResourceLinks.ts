import { locationUtil } from '@grafana/data';
import { type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { FOLDER_METADATA_FILE } from '../constants';

import { getKindInfoByResource } from './resourceKinds';

/**
 * Builds a resolver that maps a repo file/directory path to the in-app Grafana
 * URL of the resource synced from it (dashboard, folder, playlist, ...), or
 * `undefined` when the path has no synced resource or the kind has no per-item
 * view route (e.g. library panels). Callers fall back to the host repository
 * link in that case, so a README reads as file links on GitHub and as Grafana
 * pages when browsed in Grafana.
 *
 * `repositoryPath` is the repository's configured root. Resource paths from the
 * API are relative to it, whereas the paths passed to the resolver are full
 * repo-root paths (they already include the configured root), so the two are
 * joined when building the lookup.
 */
export function createGrafanaLinkResolver(
  resources: ResourceListItem[],
  repositoryPath: string | undefined
): (repoPath: string) => string | undefined {
  const byPath = new Map<string, ResourceListItem>();
  for (const resource of resources) {
    if (!resource.path) {
      continue;
    }
    byPath.set(stripTrailingSlashes(joinRepoPath(repositoryPath, resource.path)), resource);
  }

  return (repoPath) => {
    const normalized = stripTrailingSlashes(repoPath);
    if (!normalized) {
      return undefined;
    }

    // A link may point straight at a folder's _folder.json, but the folder
    // resource is keyed by its directory — fall back to the containing directory.
    const resource = byPath.get(normalized) ?? byPath.get(folderDirOf(normalized));
    if (!resource) {
      return undefined;
    }

    const route = getKindInfoByResource(resource.resource)?.getRoute?.(resource.name);
    return route ? locationUtil.assureBaseUrl(route) : undefined;
  };
}

function joinRepoPath(prefix: string | undefined, path: string): string {
  return [prefix, path]
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

/** For a `_folder.json` path, the directory the folder resource is keyed by; '' otherwise. */
function folderDirOf(path: string): string {
  if (!path.endsWith(`/${FOLDER_METADATA_FILE}`)) {
    return '';
  }
  return path.slice(0, -(FOLDER_METADATA_FILE.length + 1));
}
