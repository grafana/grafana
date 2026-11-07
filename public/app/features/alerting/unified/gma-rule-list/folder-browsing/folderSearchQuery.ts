import { type SearchQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

// Needs the `alerting.folderHasRulesLabel` toggle; the label marks folders directly holding rules of either kind.
const FOLDER_HAS_RULES_LABEL = 'alerting.grafana.app/has-rules';
const FOLDER_HAS_RULES_LABEL_VALUE = 'true';

/** With a folder filter, scopes the listing to folders with those titles, matched exactly and case-insensitively. */
export function buildFolderListSearchQuery(continueToken?: string, folderNames: string[] = []): SearchQuery {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    labelSelector: { matchLabels: { [FOLDER_HAS_RULES_LABEL]: FOLDER_HAS_RULES_LABEL_VALUE } },
    ...(folderNames.length > 0 ? { where: { filter: { field: 'title', operator: 'In', values: folderNames } } } : {}),
    fields: ['title'],
    sort: [{ field: 'title', direction: 'asc' }],
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  };
}
