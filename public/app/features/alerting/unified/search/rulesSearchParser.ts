import { isPromAlertingRuleState, PromAlertingRuleState, PromRuleType } from '../../../../types/unified-alerting-dto';
import { isPromRuleType } from '../utils/rules';

import * as terms from './search.terms';
import { applyFiltersToQuery, FilterDialect, FilterExpr, parseQueryToFilter, QueryFilterMapper } from './searchParser';

export interface RulesFilter {
  freeFormWords: string[];
  namespace?: string;
  groupName?: string;
  ruleName?: string;
  ruleState?: PromAlertingRuleState;
  ruleType?: PromRuleType;
  dataSourceName?: string;
  labels: string[];
}

const rulesSearchDialects: FilterDialect[] = [
  FilterDialect.ds,
  FilterDialect.ns,
  FilterDialect.label,
  FilterDialect.group,
  FilterDialect.rule,
  FilterDialect.state,
  FilterDialect.type,
];

export function getSearchFilterFromQuery(query: string): RulesFilter {
  const filter: RulesFilter = { labels: [], freeFormWords: [] };

  const tokenToFilterMap: QueryFilterMapper = {
    [terms.DsToken]: (value) => (filter.dataSourceName = value),
    [terms.NsToken]: (value) => (filter.namespace = value),
    [terms.GroupToken]: (value) => (filter.groupName = value),
    [terms.RuleToken]: (value) => (filter.ruleName = value),
    [terms.LabelToken]: (value) => filter.labels.push(value),
    [terms.StateToken]: (value) => (isPromAlertingRuleState(value) ? (filter.ruleState = value) : undefined),
    [terms.TypeToken]: (value) => (isPromRuleType(value) ? (filter.ruleType = value) : undefined),
    [terms.FreeFormExpression]: (value) => filter.freeFormWords.push(value),
  };

  parseQueryToFilter(query, rulesSearchDialects, tokenToFilterMap);

  return filter;
}

export function applySearchFilterToQuery(query: string, filter: RulesFilter): string {
  const filterStateArray: FilterExpr[] = [];

  // Convert filter object into an array
  // It allows to pick filters from the array in the same order as they were applied in the original query
  if (filter.dataSourceName) {
    filterStateArray.push({ type: terms.DsToken, value: filter.dataSourceName });
  }
  if (filter.namespace) {
    filterStateArray.push({ type: terms.NsToken, value: filter.namespace });
  }
  if (filter.groupName) {
    filterStateArray.push({ type: terms.GroupToken, value: filter.groupName });
  }
  if (filter.ruleName) {
    filterStateArray.push({ type: terms.RuleToken, value: filter.ruleName });
  }
  if (filter.ruleState) {
    filterStateArray.push({ type: terms.StateToken, value: filter.ruleState });
  }
  if (filter.ruleType) {
    filterStateArray.push({ type: terms.TypeToken, value: filter.ruleType });
  }
  if (filter.labels) {
    filterStateArray.push(...filter.labels.map((l) => ({ type: terms.LabelToken, value: l })));
  }
  if (filter.freeFormWords) {
    filterStateArray.push(...filter.freeFormWords.map((word) => ({ type: terms.FreeFormExpression, value: word })));
  }

  return applyFiltersToQuery(query, rulesSearchDialects, filterStateArray);
}
