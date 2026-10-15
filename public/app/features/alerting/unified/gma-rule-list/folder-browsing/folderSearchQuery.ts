import { type SearchQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

// Needs the `alerting.folderHasRulesLabel` toggle; the label marks folders directly holding rules of either kind.
export const FOLDER_HAS_RULES_LABEL = 'alerting.grafana.app/has-rules';
export const FOLDER_HAS_RULES_LABEL_VALUE = 'true';

/** With a folder filter, scopes the listing to those UIDs so counts and paths match what the user filtered to. */
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
