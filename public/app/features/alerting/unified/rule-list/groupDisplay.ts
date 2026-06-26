import { useURLSearchParams } from '../hooks/useURLSearchParams';
import { isUngroupedRuleGroup } from '../utils/rules';

import { type GrafanaRuleWithOrigin } from './hooks/useFilteredRulesIterator';

/**
 * PoC switch for how rule groups are surfaced in the k8s `/search`-backed list.
 * - `flat`: current behaviour (no group level).
 * - `rows`: group-header rows in the grouped view (Option 1).
 * - `pill`: a group-name pill on each GMA rule row (Option 2).
 * - `merged`: single-rule groups render as a pill, multi-rule groups as a lightweight section
 *   (grouped view); the filter view always uses the pill.
 */
export type GroupDisplayMode = 'flat' | 'rows' | 'pill' | 'merged';

/** Header style for Option 1 (`rows`). */
export type GroupRowStyle = 'collapsible' | 'inline';

interface GroupDisplayParams {
  mode: GroupDisplayMode;
  rowStyle: GroupRowStyle;
}

/** Reads the `groupDisplay` / `groupRowStyle` URL params that drive the PoC. */
export function useGroupDisplayParams(): GroupDisplayParams {
  const [params] = useURLSearchParams();

  const rawMode = params.get('groupDisplay');
  const mode: GroupDisplayMode =
    rawMode === 'rows' || rawMode === 'pill' || rawMode === 'merged' || rawMode === 'flat' ? rawMode : 'pill';

  const rowStyle: GroupRowStyle = params.get('groupRowStyle') === 'inline' ? 'inline' : 'collapsible';

  return { mode, rowStyle };
}

/** A rule with no real group: missing group, or the artificial `no_group_for_rule_*` sentinel. */
export function isUngroupedOrEmpty(groupName: string | undefined): boolean {
  return !groupName || isUngroupedRuleGroup(groupName);
}

export interface RuleGroupBucket {
  groupName: string;
  rules: GrafanaRuleWithOrigin[];
}

export interface GroupedRules {
  /** Groups in first-seen order. With `sort=group` the source is already group-contiguous. */
  groups: RuleGroupBucket[];
  /** Rules with no real group, rendered directly without a group header. */
  ungrouped: GrafanaRuleWithOrigin[];
}

/**
 * Buckets rules by group name, preserving first-seen order. Same-name groups are merged so the
 * result is stable even if the source isn't perfectly contiguous (e.g. a group split across pages).
 */
export function groupRulesByGroup(rules: GrafanaRuleWithOrigin[]): GroupedRules {
  const groups: RuleGroupBucket[] = [];
  const ungrouped: GrafanaRuleWithOrigin[] = [];
  const indexByName = new Map<string, number>();

  for (const rule of rules) {
    const groupName = rule.groupIdentifier.groupName;
    if (isUngroupedOrEmpty(groupName)) {
      ungrouped.push(rule);
      continue;
    }

    let index = indexByName.get(groupName);
    if (index === undefined) {
      index = groups.length;
      indexByName.set(groupName, index);
      groups.push({ groupName, rules: [] });
    }
    groups[index].rules.push(rule);
  }

  return { groups, ungrouped };
}
