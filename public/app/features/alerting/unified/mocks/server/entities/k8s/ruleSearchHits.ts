import { Factory } from 'fishery';

import {
  type AlertRuleSearchHit,
  type RecordingRuleSearchHit,
  type RuleSearchHit,
} from 'app/features/alerting/unified/rule-list/hooks/useK8sRulesSearch';

export const alertRuleHitFactory = Factory.define<AlertRuleSearchHit>(({ sequence }) => ({
  type: 'alertrule',
  name: `alert-rule-${sequence}`,
  title: `Alert rule ${sequence}`,
  folder: 'folder-uid',
}));

export const recordingRuleHitFactory = Factory.define<RecordingRuleSearchHit>(({ sequence }) => ({
  type: 'recordingrule',
  name: `recording-rule-${sequence}`,
  title: `Recording rule ${sequence}`,
  folder: 'folder-uid',
}));

/** Mirrors the query params accepted by `GET /apis/rules.alerting.grafana.app/v0alpha1/.../search`. */
export interface RuleSearchQueryParams {
  q?: string;
  labels?: string[];
  groups?: string[];
  folders?: string[];
  names?: string[];
  datasourceUIDs?: string[];
  type?: string;
  paused?: string;
  dashboardUID?: string;
  receiver?: string;
  notificationType?: string;
  routingTree?: string;
  metric?: string;
  targetDatasourceUID?: string;
  sort?: string;
}

type LabelMatcherOp = 'equals' | 'notEquals' | 'exists' | 'notExists';
interface LabelMatcher {
  key: string;
  value?: string;
  op: LabelMatcherOp;
}

/** Mirrors `requirementToLabelMatchers` in pkg/registry/apps/alerting/rules/search/query.go. */
function parseLabelMatchers(terms: string[]): LabelMatcher[] {
  return terms.map((term) => {
    const eqIndex = term.indexOf('=');
    if (eqIndex === -1) {
      const negated = term.startsWith('!');
      return negated ? { key: term.slice(1), op: 'notExists' } : { key: term, op: 'exists' };
    }

    const negated = term[eqIndex - 1] === '!';
    const key = negated ? term.slice(0, eqIndex - 1) : term.slice(0, eqIndex);
    const value = term.slice(eqIndex + 1);
    return { key, value, op: negated ? 'notEquals' : 'equals' };
  });
}

function matchesLabelMatchers(hit: RuleSearchHit, matchers: LabelMatcher[]): boolean {
  return matchers.every((matcher) => {
    const value = hit.labels?.[matcher.key];
    switch (matcher.op) {
      case 'exists':
        return value !== undefined;
      case 'notExists':
        return value === undefined;
      case 'equals':
        return value === matcher.value;
      case 'notEquals':
        return value !== matcher.value;
    }
  });
}

function matchesAnyOf(value: string | undefined, candidates: string[] | undefined): boolean {
  if (!candidates || candidates.length === 0) {
    return true;
  }
  return value !== undefined && candidates.includes(value);
}

/** Simplified reimplementation of pkg/registry/apps/alerting/rules/search/{search,query}.go's filtering. */
export function filterRuleSearchHits(hits: RuleSearchHit[], params: RuleSearchQueryParams): RuleSearchHit[] {
  const labelMatchers = params.labels && params.labels.length > 0 ? parseLabelMatchers(params.labels) : [];

  return hits.filter((hit) => {
    if (params.q && !hit.title.toLowerCase().includes(params.q.toLowerCase())) {
      return false;
    }
    if (labelMatchers.length > 0 && !matchesLabelMatchers(hit, labelMatchers)) {
      return false;
    }
    if (!matchesAnyOf(hit.group, params.groups)) {
      return false;
    }
    if (!matchesAnyOf(hit.folder, params.folders)) {
      return false;
    }
    if (!matchesAnyOf(hit.name, params.names)) {
      return false;
    }
    if (params.type && hit.type !== params.type) {
      return false;
    }
    if (params.paused !== undefined && String(hit.paused ?? false) !== params.paused) {
      return false;
    }
    if (params.datasourceUIDs && params.datasourceUIDs.length > 0) {
      const hitDatasourceUids = hit.datasourceUIDs ?? [];
      if (!params.datasourceUIDs.some((uid) => hitDatasourceUids.includes(uid))) {
        return false;
      }
    }
    // dashboardUID/receiver/notificationType/routingTree only exist on alert rules, and
    // metric/targetDatasourceUID only on recording rules — a hit of the other kind can never
    // match a filter on those fields, so it's excluded rather than passed through unfiltered.
    if (params.dashboardUID && (hit.type !== 'alertrule' || hit.dashboardUID !== params.dashboardUID)) {
      return false;
    }
    if (params.receiver && (hit.type !== 'alertrule' || hit.receiver !== params.receiver)) {
      return false;
    }
    if (params.notificationType && (hit.type !== 'alertrule' || hit.notificationType !== params.notificationType)) {
      return false;
    }
    if (params.routingTree && (hit.type !== 'alertrule' || hit.routingTree !== params.routingTree)) {
      return false;
    }
    if (params.metric && (hit.type !== 'recordingrule' || hit.metric !== params.metric)) {
      return false;
    }
    if (
      params.targetDatasourceUID &&
      (hit.type !== 'recordingrule' || hit.targetDatasourceUID !== params.targetDatasourceUID)
    ) {
      return false;
    }
    return true;
  });
}

/** Mirrors the `sort=title|-title|group|-group` handling in pkg/registry/apps/alerting/rules/search/query.go. */
export function sortRuleSearchHits(hits: RuleSearchHit[], sort: string | undefined): RuleSearchHit[] {
  const descending = sort?.startsWith('-') ?? false;
  const field = sort?.replace(/^-/, '') || 'title';

  const sorted = [...hits].sort((a, b) => {
    const comparison =
      field === 'group'
        ? `${a.folder}/${a.group ?? ''}/${a.title}`.localeCompare(`${b.folder}/${b.group ?? ''}/${b.title}`)
        : a.title.localeCompare(b.title);

    return descending ? -comparison : comparison;
  });

  return sorted;
}
