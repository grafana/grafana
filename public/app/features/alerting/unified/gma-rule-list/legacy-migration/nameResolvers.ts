import { type ResultItem, generatedAPI as folderSearchAPI } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { dispatch } from 'app/store/store';

import { type NameResolvers } from './migrationResolve';

/**
 * Resolves a legacy folder display name to its UID via the folder search subresource. Returns
 * undefined - never a guess - when no folder or more than one folder shares that exact title, so
 * the caller keeps the token unresolved rather than searching unfiltered.
 */
export async function resolveFolderUidByName(name: string): Promise<string | undefined> {
  const title = name.trim();
  if (!title) {
    return undefined;
  }

  const result = await dispatch(
    folderSearchAPI.endpoints.listFolderSearchV1Beta1.initiate({
      searchQuery: {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        where: { and: [{ text: { value: title, fields: ['title'] } }] },
        fields: ['title'],
        limit: 40,
      },
    })
  ).unwrap();

  const exactMatches = result.items.filter((item: ResultItem) => item.fields?.title === title);
  return exactMatches.length === 1 ? exactMatches[0].resource.name : undefined;
}

/**
 * Resolves a legacy data source display name to its UID from the already-loaded instance
 * settings cache. Rejects a match where the resolved settings' own name doesn't equal the
 * input, since `getDataSourceInstanceSettings` also accepts a UID or the literal "default".
 */
export async function resolveDataSourceUidByName(name: string): Promise<string | undefined> {
  const trimmed = name.trim();
  if (!trimmed) {
    return undefined;
  }

  const settings = await getDataSourceInstanceSettings(trimmed);
  return settings?.name === trimmed ? settings.uid : undefined;
}

export const legacyRuleListNameResolvers: NameResolvers = {
  resolveFolderUidByName,
  resolveDataSourceUidByName,
};
