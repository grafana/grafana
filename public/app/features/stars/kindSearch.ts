import { getAPINamespace } from '@grafana/api-clients';
import { getBackendSrv } from '@grafana/runtime';
import { getAPIGroupVersions } from 'app/features/apiserver/discovery';

import { type StarredKind } from './kinds';

/**
 * Resolves starred names of a plugin kind to titles and folders through the kind's own search
 * endpoint, `POST /apis/{group}/{version}/namespaces/{ns}/{plural}/search`, which the app platform
 * mounts for every served namespaced kind. The served version and plural come from API discovery,
 * so a plugin declares only its group and kind, and a version bump needs no change here.
 */

const SEARCH_API_VERSION = 'search.grafana.app/v0alpha1';
const SEARCH_QUERY_KIND = 'SearchQuery';
// Server page-size cap for a single search request
const MAX_SEARCH_LIMIT = 500;

export interface StarredResource {
  name: string;
  title: string;
  folder: string;
  description: string;
  tags: string[];
}

export interface StarredResourceFilter {
  text?: string;
  tags?: string[];
  folder?: string;
}

interface WhereNode {
  and?: WhereNode[];
  text?: { value: string; fields?: string[] };
  filter?: { field: string; operator: 'In' | 'NotIn' | 'All'; values: string[] };
}

interface SearchItem {
  resource: { group: string; resource: string; kind: string; name: string };
  /** The requested fields' values. Absent fields are omitted, so read defensively. */
  fields?: Record<string, unknown>;
}

interface SearchResults {
  items?: SearchItem[];
}

interface APIResourceList {
  resources: Array<{ name: string; kind: string }>;
}

// Served version and plural per kind. A kind's API does not change within a page load.
const resourceBaseURLs = new Map<string, Promise<string>>();

/** `/apis/{group}/{version}/namespaces/{ns}/{plural}` of a kind, as this Grafana serves it. */
async function resourceBaseURL(kind: StarredKind): Promise<string> {
  const key = `${kind.group}/${kind.kind}`;
  let pending = resourceBaseURLs.get(key);
  if (!pending) {
    pending = discoverResourceBaseURL(kind);
    resourceBaseURLs.set(key, pending);
    // A failed discovery (plugin disabled, apiserver down) is retried on the next call
    pending.catch(() => resourceBaseURLs.delete(key));
  }
  return pending;
}

async function discoverResourceBaseURL(kind: StarredKind): Promise<string> {
  const versions = await getAPIGroupVersions(kind.group);
  const version = versions?.preferred ?? [...(versions?.versions ?? [])][0];
  if (!version) {
    throw new Error(`API group ${kind.group} is not served`);
  }
  const list = await getBackendSrv().get<APIResourceList>(`/apis/${kind.group}/${version}`, undefined, undefined, {
    showErrorAlert: false,
  });
  // Subresources are listed as `plural/sub`; the kind's own entry has no slash
  const resource = list.resources.find((candidate) => candidate.kind === kind.kind && !candidate.name.includes('/'));
  if (!resource) {
    throw new Error(`Kind ${kind.kind} is not served in ${kind.group}/${version}`);
  }
  return `/apis/${kind.group}/${version}/namespaces/${getAPINamespace()}/${resource.name}`;
}

/**
 * Titles and folders of the starred objects of a kind that the user may read. Throws on
 * transport or API errors, including a kind whose API is not served.
 */
export async function searchStarredResources(
  kind: StarredKind,
  names: string[],
  filter: StarredResourceFilter = {}
): Promise<StarredResource[]> {
  if (names.length === 0) {
    return [];
  }

  const leaves: WhereNode[] = [{ filter: { field: 'name', operator: 'In', values: names } }];
  if (filter.text && filter.text !== '*') {
    leaves.push({ text: { value: filter.text, fields: ['title', 'description'] } });
  }
  if (filter.tags?.length) {
    leaves.push({ filter: { field: 'tags', operator: 'All', values: filter.tags } });
  }
  if (filter.folder) {
    leaves.push({ filter: { field: 'folder', operator: 'In', values: [filter.folder] } });
  }

  const results = await getBackendSrv().post<SearchResults>(
    `${await resourceBaseURL(kind)}/search`,
    {
      apiVersion: SEARCH_API_VERSION,
      kind: SEARCH_QUERY_KIND,
      where: leaves.length === 1 ? leaves[0] : { and: leaves },
      fields: ['title', 'folder', 'description', 'tags'],
      limit: Math.min(names.length, MAX_SEARCH_LIMIT),
    },
    // Callers show no stars for the kind instead; a global toast for an optional plugin API would only confuse
    { showErrorAlert: false }
  );

  return (results.items ?? []).map((item) => {
    const fields = item.fields ?? {};
    return {
      name: item.resource.name,
      title: typeof fields.title === 'string' && fields.title ? fields.title : item.resource.name,
      folder: typeof fields.folder === 'string' ? fields.folder : '',
      description: typeof fields.description === 'string' ? fields.description : '',
      tags: Array.isArray(fields.tags) ? fields.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    };
  });
}
