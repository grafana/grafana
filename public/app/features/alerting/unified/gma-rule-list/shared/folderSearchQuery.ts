import { type SearchQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

/**
 * Folders mode's top-level folder listing: every readable folder, title ascending, 40 at a
 * time (alert-rules-page.md "Folder list"). When the folder filter is the active criterion -
 * the only one Folders mode supports - this scopes the listing to just those folder UIDs
 * using the standard `name` field, so the folder list and the counts/paths shown against it
 * agree with what the user actually filtered to.
 */
export function buildFolderListSearchQuery(continueToken?: string, folderUids: string[] = []): SearchQuery {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    ...(folderUids.length > 0 ? { where: { filter: { field: 'name', operator: 'In', values: folderUids } } } : {}),
    fields: ['title'],
    sort: [{ field: 'title', direction: 'asc' }],
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  };
}
