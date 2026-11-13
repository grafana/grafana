import {
  type ListAlertRuleSearchRulesV0Alpha1SearchFilterLeaf,
  type ListAlertRuleSearchRulesV0Alpha1SearchRegexLeaf,
  type ListAlertRuleSearchRulesV0Alpha1SearchTextLeaf,
  type ListAlertRuleSearchRulesV0Alpha1SearchWhereNode,
  type ListRecordingRuleSearchRulesV0Alpha1SearchFilterLeaf,
  type ListRecordingRuleSearchRulesV0Alpha1SearchRegexLeaf,
  type ListRecordingRuleSearchRulesV0Alpha1SearchTextLeaf,
  type ListRecordingRuleSearchRulesV0Alpha1SearchWhereNode,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type SharedFilterKey } from './sharedFilters';
import { HEALTH_API_VALUES, type SearchLabelMatcher, type SharedRuleFilter } from './sharedRuleFilter';

/**
 * The part of the generated where tree that the per-kind rule search accepts:
 * - one leaf, or one flat `and` of leaves
 * - filters use `In`, and `NotIn` only on labels, state and health
 * - filters have exactly one value, except on folder, datasource UIDs, state and health
 * - regex only on labels
 * - a single title text leaf
 *
 * Each type below is checked against both kinds' generated request types, so the shared leaves work on either page.
 */
export type SearchQueryNode = AcceptedByBothKinds<
  SearchQueryLeaf | { and: SearchQueryLeaf[] },
  ListAlertRuleSearchRulesV0Alpha1SearchWhereNode,
  ListRecordingRuleSearchRulesV0Alpha1SearchWhereNode
>;

type SearchQueryLeaf = AcceptedByBothKinds<
  { text: SearchQueryText } | { filter: SearchQueryFilter } | { regex: SearchQueryRegex },
  ListAlertRuleSearchRulesV0Alpha1SearchWhereNode,
  ListRecordingRuleSearchRulesV0Alpha1SearchWhereNode
>;

type SearchQueryText = AcceptedByBothKinds<
  { value: string },
  ListAlertRuleSearchRulesV0Alpha1SearchTextLeaf,
  ListRecordingRuleSearchRulesV0Alpha1SearchTextLeaf
>;

type SearchQueryFilter = AcceptedByBothKinds<
  { field: string; operator: 'In' | 'NotIn'; values: string[] },
  ListAlertRuleSearchRulesV0Alpha1SearchFilterLeaf,
  ListRecordingRuleSearchRulesV0Alpha1SearchFilterLeaf
>;

type SearchQueryRegex = AcceptedByBothKinds<
  {
    field: string;
    pattern: string;
    /** Mirrors a Prometheus matcher: `negate: true` is `!~`. */
    negate?: boolean;
  },
  ListAlertRuleSearchRulesV0Alpha1SearchRegexLeaf,
  ListRecordingRuleSearchRulesV0Alpha1SearchRegexLeaf
>;

/** A leaf and the filter it came from, so a rejected leaf can name its filter; `key` is null for the search text. */
export interface SourcedLeaf<Key extends string = string> {
  key: Key | null;
  leaf: SearchQueryLeaf;
}

/** `T` itself, as long as it is assignable to both kinds' generated type; otherwise a type error. */
type AcceptedByBothKinds<T extends AlertType & RecordingType, AlertType, RecordingType> = T;

export function buildSharedLeaves(filter: SharedRuleFilter): Array<SourcedLeaf<SharedFilterKey>> {
  const leaves: Array<SourcedLeaf<SharedFilterKey>> = [];

  const text = filter.text.join(' ').trim();
  if (text.length > 0) {
    leaves.push({ key: null, leaf: { text: { value: text } } });
  }

  if (filter.folders.length > 0) {
    leaves.push({ key: 'folder', leaf: { filter: { field: 'folder', operator: 'In', values: filter.folders } } });
  }

  if (filter.dataSourceUids.length > 0) {
    leaves.push({
      key: 'datasource',
      leaf: { filter: { field: 'datasourceUIDs', operator: 'In', values: filter.dataSourceUids } },
    });
  }

  for (const label of filter.labels) {
    leaves.push({ key: 'label', leaf: buildLabelLeaf(label) });
  }

  if (filter.hidePluginRules) {
    // Only an origin that starts with `plugin/` marks a plugin-managed rule, and a rule without
    // the label counts as an empty value, so it is kept.
    leaves.push({
      key: 'plugins',
      leaf: { regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } },
    });
  }

  return leaves;
}

/** `In` never matches a rule with no stored status, so a health filter hides those rules. */
export function buildHealthLeaves(
  filter: SharedRuleFilter,
  okValue: 'OK' | 'Recording'
): Array<SourcedLeaf<SharedFilterKey>> {
  if (!filter.health) {
    return [];
  }
  const value = filter.health === 'ok' ? okValue : HEALTH_API_VALUES[filter.health];
  return [{ key: 'health', leaf: { filter: { field: 'health', operator: 'In', values: [value] } } }];
}

/** One leaf as itself and several as one flat `and`, so a rejection's `where.and[i]` counts in `leaves` order. */
export function toWhere(leaves: SourcedLeaf[]): SearchQueryNode | undefined {
  if (leaves.length === 0) {
    return undefined;
  }
  if (leaves.length === 1) {
    return leaves[0].leaf;
  }
  return { and: leaves.map(({ leaf }) => leaf) };
}

function buildLabelLeaf({ key, operator, value = '' }: SearchLabelMatcher): SearchQueryLeaf {
  // The rule search indexes each label as both `key` and `key=value`.
  switch (operator) {
    case 'exists':
      return { filter: { field: 'labels', operator: 'In', values: [key] } };
    case 'absent':
      return { filter: { field: 'labels', operator: 'NotIn', values: [key] } };
    case 'equal':
      return { filter: { field: 'labels', operator: 'In', values: [`${key}=${value}`] } };
    case 'notEqual':
      // As in Prometheus, `team!=""` means a non-empty value. A regex treats a missing label as empty.
      return value === ''
        ? { regex: { field: 'labels', pattern: `${key}=.+` } }
        : { filter: { field: 'labels', operator: 'NotIn', values: [`${key}=${value}`] } };
    case 'regex':
      return { regex: { field: 'labels', pattern: `${key}=${value}` } };
    case 'notRegex':
      return { regex: { field: 'labels', pattern: `${key}=${value}`, negate: true } };
  }
}
