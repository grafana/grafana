import { type SearchQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { type SharedRuleFilter } from '../rule-search/sharedRuleFilter';
import { type RuleKind } from '../shared/ruleKind';

// Needs the `alerting.folderHasRulesLabel` toggle; each label marks folders directly holding rules of one kind.
const FOLDER_HAS_RULES_LABEL: Record<RuleKind, string> = {
  alert: 'alerting.grafana.app/has-alert-rules',
  recording: 'alerting.grafana.app/has-recording-rules',
};
const FOLDER_HAS_RULES_LABEL_VALUE = 'true';

/** The folder filters; a listing keeps the folders that match both. */
export type FolderScope = Pick<SharedRuleFilter, 'folder' | 'folderUids'>;

/**
 * Scopes the listing to folders whose title contains every word of `folder`, ignoring case, and whose UID is one of
 * `folderUids`, so counts and paths match what the user filtered to.
 */
export function buildFolderListSearchQuery(
  kind: RuleKind,
  continueToken?: string,
  { folder, folderUids }: FolderScope = { folderUids: [] }
): SearchQuery {
  const leaves = [
    ...(folder ? [{ text: { value: folder } }] : []),
    ...(folderUids.length > 0 ? [{ filter: { field: 'name', operator: 'In', values: folderUids } }] : []),
  ];
  return {
    apiVersion: 'search.grafana.app/v0alpha1',
    kind: 'SearchQuery',
    labelSelector: { matchLabels: { [FOLDER_HAS_RULES_LABEL[kind]]: FOLDER_HAS_RULES_LABEL_VALUE } },
    ...(leaves.length > 0 ? { where: leaves.length === 1 ? leaves[0] : { and: leaves } } : {}),
    fields: ['title'],
    sort: [{ field: 'title', direction: 'asc' }],
    limit: DEFAULT_PER_PAGE_PAGINATION,
    ...(continueToken ? { continue: continueToken } : {}),
  };
}
