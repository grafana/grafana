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

export type FolderScope = Pick<SharedRuleFilter, 'folder' | 'folderUids'>;

/** Keeps folders whose title contains every word of `folder`, ignoring case, and whose UID is in `folderUids`. */
export function buildFolderListSearchQuery(
  kind: RuleKind,
  continueToken: string | undefined,
  { folder, folderUids }: FolderScope
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
