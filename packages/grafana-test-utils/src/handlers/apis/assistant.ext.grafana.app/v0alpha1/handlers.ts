import { HttpResponse, http } from 'msw';

export const pagesSearchRoute = '/apis/assistant.ext.grafana.app/v0alpha1/namespaces/:namespace/pages/search';

export interface MockPage {
  name: string;
  title: string;
  folder?: string;
  description?: string;
  tags?: string[];
}

type WhereNode = {
  and?: WhereNode[];
  filter?: { field: string; values: string[] };
};

/**
 * Serves the Assistant Page kind's per-kind search for the given pages, honoring the `name` filter
 * leaf and `limit`. Absent fields are omitted from `fields`, as the real endpoint does.
 */
export function getPagesSearchHandler(pages: MockPage[]) {
  return http.post(pagesSearchRoute, async ({ request }) => {
    const body = (await request.json()) as { where?: WhereNode; limit?: number };
    const leaves = body.where?.and ?? (body.where ? [body.where] : []);
    const names = leaves.find((leaf) => leaf.filter?.field === 'name')?.filter?.values;
    const matched = names ? pages.filter((page) => names.includes(page.name)) : pages;

    return HttpResponse.json({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchResults',
      metadata: { totalHits: matched.length, totalHitsRelation: 'eq' },
      items: matched.slice(0, body.limit ?? matched.length).map((page) => ({
        resource: { group: 'assistant.ext.grafana.app', resource: 'pages', kind: 'Page', name: page.name },
        fields: { title: page.title, folder: page.folder, description: page.description, tags: page.tags },
      })),
    });
  });
}
