import { urlUtil, UrlQueryMap } from '@grafana/data';
import { CombinedRule, RuleFilterState, RulesSource } from 'app/types/unified-alerting';
import { ALERTMANAGER_NAME_QUERY_KEY } from './constants';
import { getRulesSourceName } from './datasource';
import * as ruleId from './rule-id';

export function createViewLink(ruleSource: RulesSource, rule: CombinedRule, returnTo: string): string {
  const sourceName = getRulesSourceName(ruleSource);
  const identifier = ruleId.fromCombinedRule(sourceName, rule);
  const paramId = encodeURIComponent(ruleId.stringifyIdentifier(identifier));
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
