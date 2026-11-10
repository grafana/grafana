import { type SearchQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { type RuleKind } from '../shared/ruleKind';

// Needs the `alerting.folderHasRulesLabel` toggle; each label marks folders directly holding rules of one kind.
const FOLDER_HAS_RULES_LABEL: Record<RuleKind, string> = {
  alert: 'alerting.grafana.app/has-alert-rules',
  recording: 'alerting.grafana.app/has-recording-rules',
};
const FOLDER_HAS_RULES_LABEL_VALUE = 'true';

/** With a folder filter, scopes the listing to those UIDs so counts and paths match what the user filtered to. */
export function buildFolderListSearchQuery(
  kind: RuleKind,
  continueToken?: string,
  folderUids: string[] = []
): SearchQuery {
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    labelSelector: { matchLabels: { [FOLDER_HAS_RULES_LABEL[kind]]: FOLDER_HAS_RULES_LABEL_VALUE } },
    ...(folderUids.length > 0 ? { where: { filter: { field: 'name', operator: 'In', values: folderUids } } } : {}),
    fields: ['title'],
    sort: [{ field: 'title', direction: 'asc' }],
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  };
}
