import { type ResultItem, generatedAPI as folderSearchAPI } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { dispatch } from 'app/store/store';

import { type NameResolvers } from './migrationResolve';

/** Undefined, never a guess, when zero or several folders share that exact title. */
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
        limit: DEFAULT_PER_PAGE_PAGINATION,
      },
    })
  ).unwrap();

  const exactMatches = result.items.filter((item: ResultItem) => item.fields?.title === title);
  return exactMatches.length === 1 ? exactMatches[0].resource.name : undefined;
}

/** `getDataSourceInstanceSettings` also accepts a UID or "default", so require an exact name match. */
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
