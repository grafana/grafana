import { urlUtil, UrlQueryMap } from '@grafana/data';
import { CombinedRule, RuleFilterState, RulesSource } from 'app/types/unified-alerting';
import { ALERTMANAGER_NAME_QUERY_KEY } from './constants';
import { getRulesSourceName } from './datasource';
import { getRuleIdentifier, stringifyRuleIdentifier } from './rules';

export function createViewLink(ruleSource: RulesSource, rule: CombinedRule, returnTo: string): string | undefined {
  const sourceName = getRulesSourceName(ruleSource);
  const { namespace, group, rulerRule } = rule;

  if (!rulerRule) {
    return;
  }

  const identifier = getRuleIdentifier(sourceName, namespace.name, group.name, rulerRule);
  const paramId = encodeURIComponent(stringifyRuleIdentifier(identifier));
  const paramSource = encodeURIComponent(sourceName);

  return urlUtil.renderUrl(`/alerting/${paramSource}/${paramId}/view`, { returnTo });
}

export function createExploreLink(dataSourceName: string, query: string) {
  return urlUtil.renderUrl('explore', {
    left: JSON.stringify([
      'now-1h',
      'now',
      dataSourceName,
      { datasource: dataSourceName, expr: query },
      { ui: [true, true, true, 'none'] },
    ]),
  });
}

// used to hash rules
export function hash(value: string): number {
  let hash = 0;
  if (value.length === 0) {
    return hash;
  }
  for (var i = 0; i < value.length; i++) {
    var char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

export function arrayToRecord(items: Array<{ key: string; value: string }>): Record<string, string> {
  return items.reduce<Record<string, string>>((rec, { key, value }) => {
    rec[key] = value;
    return rec;
  }, {});
}

export const getFiltersFromUrlParams = (queryParams: UrlQueryMap): RuleFilterState => {
  const queryString = queryParams['queryString'] === undefined ? undefined : String(queryParams['queryString']);
  const alertState = queryParams['alertState'] === undefined ? undefined : String(queryParams['alertState']);
  const dataSource = queryParams['dataSource'] === undefined ? undefined : String(queryParams['dataSource']);

  return { queryString, alertState, dataSource };
};

export function recordToArray(record: Record<string, string>): Array<{ key: string; value: string }> {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

export function makeAMLink(path: string, alertManagerName?: string): string {
  return `${path}${alertManagerName ? `?${ALERTMANAGER_NAME_QUERY_KEY}=${encodeURIComponent(alertManagerName)}` : ''}`;
}
