import { type MergeExclusive } from 'type-fest';

import {
  PromAlertingRuleState,
  type PromRuleType,
  isPromAlertingRuleState,
} from '../../../../types/unified-alerting-dto';
import { getRuleHealth, getRuleSource, isPromRuleType } from '../utils/rules';

import * as terms from './search.terms';
import {
  type FilterExpr,
  FilterSupportedTerm,
  type QueryFilterMapper,
  applyFiltersToQuery,
  parseQueryToFilter,
} from './searchParser';

interface RulesFilterBase {
  freeFormWords: string[];
  namespace?: string;
  groupName?: string;
  ruleName?: string;
  ruleState?: PromAlertingRuleState;
  ruleType?: PromRuleType;
  dataSourceNames: string[];
  labels: string[];
  ruleHealth?: RuleHealth;
  dashboardUid?: string;
  plugins?: 'hide';
  ruleSource?: RuleSource;
}

/** contactPoint and policy are mutually exclusive routing filters — only one may be set at a time. */
export type RulesFilter = RulesFilterBase &
  MergeExclusive<{ contactPoint?: string | null }, { policy?: string | null }>;

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
  FilterSupportedTerm.source,
  FilterSupportedTerm.policy,
];

export enum RuleHealth {
  Ok = 'ok',
  Error = 'error',
  NoData = 'nodata',
  Unknown = 'unknown',
}

export enum RuleSource {
  Grafana = 'grafana',
  DataSource = 'datasource',
}

/**
 * Constructs the mutually exclusive routing portion of a RulesFilter.
 * Each branch returns only one of the two fields, which TypeScript can
 * verify statically — no type assertion needed.
 * policy takes precedence when both are provided.
 */
export function buildRoutingFilter(
  contactPoint: string | undefined,
  policy: string | undefined
): MergeExclusive<{ contactPoint?: string }, { policy?: string }> {
  if (policy) {
    return { policy };
  }
  return { contactPoint };
}

// Define how to map parsed tokens into the filter object
export function getSearchFilterFromQuery(query: string): RulesFilter {
  const baseFilter: RulesFilterBase = {
    labels: [],
    freeFormWords: [],
    dataSourceNames: [],
  };

  let parsedContactPoint: string | undefined;
  let parsedPolicy: string | undefined;

  const tokenToFilterMap: QueryFilterMapper = {
    [terms.DataSourceToken]: (value) => baseFilter.dataSourceNames.push(value),
    [terms.NameSpaceToken]: (value) => (baseFilter.namespace = value),
    [terms.GroupToken]: (value) => (baseFilter.groupName = value),
    [terms.RuleToken]: (value) => (baseFilter.ruleName = value),
    [terms.LabelToken]: (value) => baseFilter.labels.push(value),
    [terms.StateToken]: (value) => (baseFilter.ruleState = parseStateToken(value)),
    [terms.TypeToken]: (value) => (isPromRuleType(value) ? (baseFilter.ruleType = value) : undefined),
    [terms.HealthToken]: (value) => (baseFilter.ruleHealth = getRuleHealth(value)),
    [terms.DashboardToken]: (value) => (baseFilter.dashboardUid = value),
    [terms.PluginsToken]: (value) => (baseFilter.plugins = value === 'hide' ? value : undefined),
    [terms.ContactPointToken]: (value) => (parsedContactPoint = value),
    [terms.RuleSourceToken]: (value) => (baseFilter.ruleSource = getRuleSource(value)),
    [terms.PolicyToken]: (value) => (parsedPolicy = value),
    [terms.FreeFormExpression]: (value) => baseFilter.freeFormWords.push(value),
  };

  parseQueryToFilter(query, filterSupportedTerms, tokenToFilterMap);

  // policy wins if both tokens appear in the query (e.g. manually typed URL)
  return { ...baseFilter, ...buildRoutingFilter(parsedContactPoint, parsedPolicy) };
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
  if (filter.ruleSource) {
    filterStateArray.push({ type: terms.RuleSourceToken, value: filter.ruleSource });
  }
  if (filter.freeFormWords) {
    filterStateArray.push(...filter.freeFormWords.map((word) => ({ type: terms.FreeFormExpression, value: word })));
  }
  if (filter.contactPoint && !filter.policy) {
    filterStateArray.push({ type: terms.ContactPointToken, value: filter.contactPoint });
  }
  if (filter.policy) {
    filterStateArray.push({ type: terms.PolicyToken, value: filter.policy });
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
