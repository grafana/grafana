import { config, getBackendSrv } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import { ASSISTANT_PAGES_API_GROUP, ASSISTANT_PAGES_API_VERSION, ASSISTANT_PAGES_PATH } from 'app/core/constants';

/**
 * Client for `POST .../pages/search`, the per-kind search endpoint the Assistant's Page kind gets
 * from pkg/services/apiserver/searchroutes. Pages live in their own index, so the dashboard
 * searcher cannot resolve them; this is the only place in core that knows the Pages API shape.
 */

const SEARCH_API_VERSION = 'search.grafana.app/v0alpha1';
const SEARCH_QUERY_KIND = 'SearchQuery';
// Server page-size cap for a single search request
const MAX_PAGE_SEARCH_LIMIT = 500;

export interface StarredPage {
  name: string;
  title: string;
  folder: string;
  description: string;
  tags: string[];
}

export interface StarredPagesFilter {
  text?: string;
  tags?: string[];
  folder?: string;
}

interface WhereNode {
  and?: WhereNode[];
  text?: { value: string; fields?: string[] };
  filter?: { field: string; operator: 'In' | 'NotIn' | 'All'; values: string[] };
}

interface PageSearchItem {
  resource: { group: string; resource: string; kind: string; name: string };
  /** The requested fields' values. Absent fields are omitted, so read defensively. */
  fields?: Record<string, unknown>;
}

interface PageSearchResults {
  items?: PageSearchItem[];
}

/** URL of a Page by k8s name; the full UUID form always resolves, unlike the slugged named links. */
export function starredPageURL(name: string): string {
  return `${config.appSubUrl}${ASSISTANT_PAGES_PATH}/${encodeURIComponent(name)}`;
}

/** Titles/folders of the starred Pages the user may read, via the per-kind search endpoint; throws on transport/API error. */
export async function searchStarredPages(names: string[], filter: StarredPagesFilter = {}): Promise<StarredPage[]> {
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

  const url = `${getAPIBaseURL(ASSISTANT_PAGES_API_GROUP, ASSISTANT_PAGES_API_VERSION)}/pages/search`;
  const results = await getBackendSrv().post<PageSearchResults>(
    url,
    {
      apiVersion: SEARCH_API_VERSION,
      kind: SEARCH_QUERY_KIND,
      where: leaves.length === 1 ? leaves[0] : { and: leaves },
      fields: ['title', 'folder', 'description', 'tags'],
      limit: Math.min(names.length, MAX_PAGE_SEARCH_LIMIT),
    },
    // Callers fall back to showing no pages; a global toast for an optional plugin API would only confuse
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
