import { type SearchQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

// Folders are labelled when they directly contain rules of either kind, so filtering on the label
// lists only folders worth showing in one search. Needs the `alerting.folderHasRulesLabel` toggle.
export const FOLDER_HAS_RULES_LABEL = 'alerting.grafana.app/has-rules';
export const FOLDER_HAS_RULES_LABEL_VALUE = 'true';

/**
 * Folders mode's top-level folder listing: readable folders that directly contain rules, title
 * ascending, 40 at a time. When the folder filter is the active criterion - the only one Folders
 * mode supports - this scopes the listing to just those folder UIDs using the standard `name`
 * field, so the folder list and the counts/paths shown against it agree with what the user
 * actually filtered to.
 */
export function buildFolderListSearchQuery(continueToken?: string, folderUids: string[] = []): SearchQuery {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    labelSelector: { matchLabels: { [FOLDER_HAS_RULES_LABEL]: FOLDER_HAS_RULES_LABEL_VALUE } },
    ...(folderUids.length > 0 ? { where: { filter: { field: 'name', operator: 'In', values: folderUids } } } : {}),
    fields: ['title'],
    sort: [{ field: 'title', direction: 'asc' }],
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  };
}
