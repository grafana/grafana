import { locationUtil } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import { getAPIGroupVersions } from 'app/features/apiserver/discovery';

import { type ResourceRef } from './api/globalSearchApi';
import { getKindInfo } from './kinds';

const FOLDER_ANNOTATION = 'grafana.app/folder';

// Search results carry no version, so ask the server which one it serves for each group.
const versionCache = new Map<string, Promise<string>>();

export function resolveVersion(group: string): Promise<string> {
  let version = versionCache.get(group);
  if (!version) {
    version = getAPIGroupVersions(group).then((found) => {
      const resolved = found?.preferred ?? found?.versions.values().next().value;
      if (!resolved) {
        throw new Error(`API group ${group} is not served`);
      }
      return resolved;
    });
    // A failed lookup shouldn't stick, the group may be served after a restart.
    version.catch(() => versionCache.delete(group));
    versionCache.set(group, version);
  }
  return version;
}

export async function objectURL(ref: ResourceRef): Promise<string> {
  const version = await resolveVersion(ref.group);
  return `${getAPIBaseURL(ref.group, version)}/${ref.resource}/${encodeURIComponent(ref.name)}`;
}

/** In-app path, or undefined for types with nowhere to open. */
export function openPath(ref: ResourceRef): string | undefined {
  return getKindInfo(ref).url?.(ref.name);
}

/** Absolute link for sharing outside this tab. */
export function shareURL(ref: ResourceRef): string | undefined {
  const path = openPath(ref);
  return path ? new URL(locationUtil.assureBaseUrl(path), window.location.origin).href : undefined;
}

export async function getObject(ref: ResourceRef): Promise<unknown> {
  return getBackendSrv().get(await objectURL(ref), undefined, undefined, { showErrorAlert: false });
}

/** An empty folder means the root, which is no annotation at all. */
export async function moveToFolder(ref: ResourceRef, folderUID: string | undefined): Promise<void> {
  await getBackendSrv().patch(
    await objectURL(ref),
    { metadata: { annotations: { [FOLDER_ANNOTATION]: folderUID || null } } },
    { headers: { 'Content-Type': 'application/merge-patch+json' }, showErrorAlert: false }
  );
}

export async function deleteObject(ref: ResourceRef): Promise<void> {
  await getBackendSrv().delete(await objectURL(ref), undefined, { showErrorAlert: false });
}

// The stars API rejects everything but dashboards until stars move to unified storage.
const SERVER_STARRABLE = new Set(['dashboard.grafana.app/Dashboard']);

export function starTarget(ref: ResourceRef): { group: string; kind: string } | undefined {
  const star = getKindInfo(ref).star;
  return star && SERVER_STARRABLE.has(`${star.group}/${star.kind}`) ? star : undefined;
}

export function canMove(ref: ResourceRef): boolean {
  return getKindInfo(ref).supportsFolders;
}
