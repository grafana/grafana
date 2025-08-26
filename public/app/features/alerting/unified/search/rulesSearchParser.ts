import { PromAlertingRuleState, PromRuleType, isPromAlertingRuleState } from '../../../../types/unified-alerting-dto';
import { getRuleHealth, isPromRuleType } from '../utils/rules';

import * as terms from './search.terms';
import {
  FilterExpr,
  FilterSupportedTerm,
  QueryFilterMapper,
  applyFiltersToQuery,
  parseQueryToFilter,
} from './searchParser';

export interface RulesFilter {
  freeFormWords: string[];
  namespace?: string;
  groupName?: string;
  ruleName?: string;
  ruleState?: PromAlertingRuleState;
  ruleType?: PromRuleType;
  dataSourceNames: string[];
  gmaQueryDataSourceNames?: string[];
  labels: string[];
  ruleHealth?: RuleHealth;
  dashboardUid?: string;
  plugins?: 'hide';
  contactPoint?: string | null;
}

const filterSupportedTerms: FilterSupportedTerm[] = [
  FilterSupportedTerm.dataSource,
  FilterSupportedTerm.nameSpace,
  FilterSupportedTerm.label,
  FilterSupportedTerm.group,
  FilterSupportedTerm.rule,
  FilterSupportedTerm.state,
  FilterSupportedTerm.type,
  FilterSupportedTerm.health,
  FilterSupportedTerm.dashboard,
  FilterSupportedTerm.plugins,
  FilterSupportedTerm.contactPoint,
];

export enum RuleHealth {
  Ok = 'ok',
  Error = 'error',
  NoData = 'nodata',
  Unknown = 'unknown',
}

// Define how to map parsed tokens into the filter object
export function getSearchFilterFromQuery(query: string): RulesFilter {
  const filter: RulesFilter = { labels: [], freeFormWords: [], dataSourceNames: [], gmaQueryDataSourceNames: [] };

  const tokenToFilterMap: QueryFilterMapper = {
    [terms.DataSourceToken]: (value) => filter.dataSourceNames.push(value),
    [terms.NameSpaceToken]: (value) => (filter.namespace = value),
    [terms.GroupToken]: (value) => (filter.groupName = value),
    [terms.RuleToken]: (value) => (filter.ruleName = value),
    [terms.LabelToken]: (value) => filter.labels.push(value),
    [terms.StateToken]: (value) => (filter.ruleState = parseStateToken(value)),
    [terms.TypeToken]: (value) => (isPromRuleType(value) ? (filter.ruleType = value) : undefined),
    [terms.HealthToken]: (value) => (filter.ruleHealth = getRuleHealth(value)),
    [terms.DashboardToken]: (value) => (filter.dashboardUid = value),
    [terms.PluginsToken]: (value) => (filter.plugins = value === 'hide' ? value : undefined),
    [terms.ContactPointToken]: (value) => (filter.contactPoint = value),
    [terms.FreeFormExpression]: (value) => filter.freeFormWords.push(value),
  };

  parseQueryToFilter(query, filterSupportedTerms, tokenToFilterMap);

  return filter;
}

// Reverse of the previous function
// Describes how to map the object into an array of tokens and values
export function applySearchFilterToQuery(query: string, filter: RulesFilter): string {
  const filterStateArray: FilterExpr[] = [];

  // Convert filter object into an array
  // It allows to pick filters from the array in the same order as they were applied in the original query
  if (filter.dataSourceNames) {
    filterStateArray.push(...filter.dataSourceNames.map((t) => ({ type: terms.DataSourceToken, value: t })));
  }
  if (filter.namespace) {
    filterStateArray.push({ type: terms.NameSpaceToken, value: filter.namespace });
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
  if (filter.ruleHealth) {
    filterStateArray.push({ type: terms.HealthToken, value: filter.ruleHealth });
  }
  if (filter.labels) {
    filterStateArray.push(...filter.labels.map((l) => ({ type: terms.LabelToken, value: l })));
  }
  if (filter.dashboardUid) {
    filterStateArray.push({ type: terms.DashboardToken, value: filter.dashboardUid });
  }
  if (filter.plugins) {
    filterStateArray.push({ type: terms.PluginsToken, value: filter.plugins });
  }
  if (filter.freeFormWords) {
    filterStateArray.push(...filter.freeFormWords.map((word) => ({ type: terms.FreeFormExpression, value: word })));
  }
  if (filter.contactPoint) {
    filterStateArray.push({ type: terms.ContactPointToken, value: filter.contactPoint });
  }

  return applyFiltersToQuery(query, filterSupportedTerms, filterStateArray);
}

function parseStateToken(value: string): PromAlertingRuleState | undefined {
  if (value === 'normal') {
    return PromAlertingRuleState.Inactive;
  }

  if (isPromAlertingRuleState(value)) {
    return value;
  }

  return;
}
