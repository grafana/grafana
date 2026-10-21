import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type StarsList } from 'app/api/clients/collections/v1alpha1';
import { ASSISTANT_PAGES_API_GROUP } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';

/** Extracts the `names` for a given resource group/kind from a collections stars response. */
export function findStarredNames(stars: StarsList | undefined, group: string, kind: string): string[] {
  return stars?.items?.[0]?.spec.resource.find((r) => r.group === group && r.kind === kind)?.names ?? [];
}

/** Field selector for the current user's stars resource (one Stars object per user, named `user-<uid>`). */
export function userStarsFieldSelector(): string {
  return `metadata.name=user-${contextSrv.user.uid}`;
}

/** API group/kind under which core stars store a search-result kind; undefined for kinds that cannot be starred (e.g. panel). */
export function starResourceForKind(kind: string): { group: string; kind: string } | undefined {
  switch (kind) {
    case 'dashboard':
      return { group: DASHBOARD_API_GROUP, kind: 'Dashboard' };
    case 'folder':
      return { group: FOLDER_API_GROUP, kind: 'Folder' };
    case 'page':
      return { group: ASSISTANT_PAGES_API_GROUP, kind: 'Page' };
    default:
      return undefined;
  }
}
