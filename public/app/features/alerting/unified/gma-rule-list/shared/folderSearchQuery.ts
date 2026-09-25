import { type SearchQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

/**
 * Folders mode's top-level folder listing: every readable folder, title ascending, 40 at a
 * time (alert-rules-page.md "Folder list"). The folder search API cannot filter to only
 * folders containing rules yet, so this intentionally has no `where` clause.
 */
export function buildFolderListSearchQuery(continueToken?: string): SearchQuery {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    fields: ['title'],
    sort: [{ field: 'title', direction: 'asc' }],
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  };
}
