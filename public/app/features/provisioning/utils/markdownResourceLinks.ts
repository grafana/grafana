import { type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { FOLDER_METADATA_FILE } from '../constants';

import { getKindInfoByResource } from './resourceKinds';

/**
 * Builds a resolver that maps a repo file/directory path to the in-app Grafana
 * route of the resource synced from it (dashboard, folder, playlist, ...), or
 * `undefined` when the path has no synced resource or the kind has no per-item
 * view route (e.g. library panels). Callers fall back to the host repository
 * link in that case, so a README reads as file links on GitHub and as Grafana
 * pages when browsed in Grafana. The route is app-relative (e.g. `/d/uid`) for
 * SPA navigation via `locationService`.
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
    // The repository's root folder has an empty path; it's stored under the empty
    // key (or the configured root once joined) so a root `_folder.json` link can
    // resolve to it. Leading slashes are trimmed so an absolute configured root
    // (e.g. a `local` repo's filesystem path `/data/repo`) matches the rewriter's
    // resolved paths, which have their leading slash stripped.
    byPath.set(trimSlashes(joinRepoPath(repositoryPath, resource.path)), resource);
  }

  return (repoPath) => {
    const normalized = trimSlashes(repoPath);

    // A link may point straight at a folder's _folder.json, but the folder
    // resource is keyed by its directory (empty for the repo root) — fall back to
    // it. Returns undefined for non-metadata paths so an unrelated file can't
    // match a root-keyed entry.
    const metadataDir = folderMetadataDir(normalized);
    const resource = byPath.get(normalized) ?? (metadataDir !== undefined ? byPath.get(metadataDir) : undefined);
    // Without a resource name there's no per-item route to build; fall back to the
    // host link rather than pushing a broken route (e.g. `/d/`, which 404s home).
    if (!resource?.name) {
      return undefined;
    }

    return getKindInfoByResource(resource.resource)?.getRoute?.(resource.name);
  };
}

function joinRepoPath(prefix: string | undefined, path: string): string {
  return [prefix, path]
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

function trimSlashes(s: string): string {
  return s.replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * For a folder-metadata (`_folder.json`) path, the directory the folder resource
 * is keyed by (`''` for the repo root). Returns `undefined` for non-metadata
 * paths, so the resolver only falls back to a directory for real metadata links.
 */
function folderMetadataDir(path: string): string | undefined {
  if (path === FOLDER_METADATA_FILE) {
    return '';
  }
  if (path.endsWith(`/${FOLDER_METADATA_FILE}`)) {
    return path.slice(0, -(FOLDER_METADATA_FILE.length + 1));
  }
  return undefined;
}
