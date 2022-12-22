import { SyntaxNode } from '@lezer/common';
import { trim } from 'lodash';
import { useCallback, useMemo } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import {
  isPromAlertingRuleState,
  PromAlertingRuleState,
  PromRuleType,
  RulerGrafanaRuleDTO,
} from 'app/types/unified-alerting-dto';

import { parser } from '../search/search';
import * as terms from '../search/search.terms';
import { labelsMatchMatchers, parseMatcher } from '../utils/alertmanager';
import { isCloudRulesSource } from '../utils/datasource';
import { getFiltersFromUrlParams } from '../utils/misc';
import { isAlertingRule, isGrafanaRulerRule } from '../utils/rules';

import { useURLSearchParams } from './useURLSearchParams';

export interface SearchFilterState {
  query?: string;
  namespace?: string;
  groupName?: string;
  ruleName?: string;
  ruleState?: PromAlertingRuleState; // Unify somehow with Prometheus rules
  ruleType?: PromRuleType;
  dataSourceName?: string;
  labels: string[];
}

const filterTermToTypeMap: Record<number, string> = {
  [terms.DataSourceFilter]: 'ds',
  [terms.NameSpaceFilter]: 'ns',
  [terms.LabelFilter]: 'l',
  [terms.RuleFilter]: 'r',
  [terms.StateFilter]: 's',
  [terms.TypeFilter]: 't',
  [terms.GroupFilter]: 'g',
};

function isPromRuleType(ruleType: string): ruleType is PromRuleType {
  return Object.values<string>(PromRuleType).includes(ruleType);
}

function getSearchFilterFromQuery(query: string): SearchFilterState {
  const parsed = parser.parse(query);

  const filterState: SearchFilterState = { labels: [] };

  let cursor = parsed.cursor();
  do {
    if (cursor.node.type.id === terms.FilterExpression) {
      // ds:prom FilterExpression
      // ds: DataSourceFilter prom FilterValue
      const valueNode = cursor.node.firstChild?.getChild(terms.FilterValue);
      const filterValue = valueNode ? trim(query.substring(valueNode.from, valueNode.to), '"') : undefined;

      // ds | ns | group | etc...
      const filterType = cursor.node.firstChild?.type.id;

      if (filterType && filterValue) {
        switch (filterType) {
          case terms.DataSourceFilter:
            filterState.dataSourceName = filterValue;
            break;
          case terms.NameSpaceFilter:
            filterState.namespace = filterValue;
            break;
          case terms.GroupFilter:
            filterState.groupName = filterValue;
            break;
          case terms.RuleFilter:
            filterState.ruleName = filterValue;
            break;
          case terms.LabelFilter:
            filterState.labels.push(filterValue);
            break;
          case terms.StateFilter:
            const state = filterValue.toLowerCase();
            if (isPromAlertingRuleState(state)) {
              filterState.ruleState = state;
            }
            break;
          case terms.TypeFilter:
            if (isPromRuleType(filterValue)) {
              filterState.ruleType = filterValue;
            }
            break;
        }
      }
    } else if (cursor.node.type.id === terms.FreeFormExpression) {
      filterState.query = query.substring(cursor.node.from, cursor.node.to);
    }
  } while (cursor.next());

  return filterState;
}

function updateSearchFilterQuery(query: string, filter: SearchFilterState): string {
  const parsed = parser.parse(query);

  let cursor = parsed.cursor();

  const filterStateArray: Array<{ type: number; value: string }> = [];
  if (filter.query) {
    filterStateArray.push({ type: terms.FreeFormExpression, value: filter.query });
  }
  if (filter.dataSourceName) {
    filterStateArray.push({ type: terms.DataSourceFilter, value: filter.dataSourceName });
  }
  if (filter.namespace) {
    filterStateArray.push({ type: terms.NameSpaceFilter, value: filter.namespace });
  }
  if (filter.groupName) {
    filterStateArray.push({ type: terms.GroupFilter, value: filter.groupName });
  }
  if (filter.ruleName) {
    filterStateArray.push({ type: terms.RuleFilter, value: filter.ruleName });
  }
  if (filter.ruleState) {
    filterStateArray.push({ type: terms.StateFilter, value: filter.ruleState });
  }
  if (filter.ruleType) {
    filterStateArray.push({ type: terms.TypeFilter, value: filter.ruleType });
  }
  if (filter.labels) {
    filterStateArray.push(...filter.labels.map((l) => ({ type: terms.LabelFilter, value: l })));
  }

  const existingTreeFilters: SyntaxNode[] = [];

  do {
    if (cursor.node.type.id === terms.FilterExpression && cursor.node.firstChild) {
      existingTreeFilters.push(cursor.node.firstChild);
    }
  } while (cursor.next());

  let newQueryExpressions: string[] = [];

  existingTreeFilters.map((filterNode) => {
    const matchingFilterIdx = filterStateArray.findIndex((f) => f.type === filterNode.type.id);
    const filterValueNode = filterNode.getChild(terms.FilterValue);
    if (matchingFilterIdx !== -1 && filterValueNode) {
      const filterToken = query.substring(filterNode.from, filterValueNode.from); // Extract the filter type only
      const filterItem = filterStateArray.splice(matchingFilterIdx, 1)[0];
      newQueryExpressions.push(`${filterToken}${getSafeFilterValue(filterItem.value)}`);
    }
  });

  filterStateArray.forEach((fs) => {
    newQueryExpressions.push(`${filterTermToTypeMap[fs.type]}:${getSafeFilterValue(fs.value)}`);
  });

  return newQueryExpressions.join(' ');
}

function getSafeFilterValue(filterValue: string) {
  const containsWhiteSpaces = /\s/.test(filterValue);
  return containsWhiteSpaces ? `\"${filterValue}\"` : filterValue;
}

export function useRulesFilter() {
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const queryString = queryParams.get('queryString') ?? '';

  const filters = getSearchFilterFromQuery(queryString);

  const updateFilters = useCallback(
    (newFilter: SearchFilterState) => {
      const newQueryString = updateSearchFilterQuery(queryString, newFilter);
      updateQueryParams({ queryString: newQueryString });
    },
    [queryString, updateQueryParams]
  );

  return { filters, queryString, updateFilters };
}

export const useFilteredRules = (namespaces: CombinedRuleNamespace[]) => {
  const [queryParams] = useQueryParams();
  const filters = getFiltersFromUrlParams(queryParams);

  const freeFormQuery = filters.queryString ?? '';
  const ngFilters = getSearchFilterFromQuery(freeFormQuery);

  console.log(ngFilters);

  return useMemo(() => filterRules(namespaces, ngFilters), [namespaces, ngFilters]);
};

export const filterRules = (
  namespaces: CombinedRuleNamespace[],
  ngFilters: SearchFilterState = { labels: [] }
): CombinedRuleNamespace[] => {
  return (
    namespaces
      .filter((ns) => (ngFilters.namespace ? ns.name.toLowerCase().includes(ngFilters.namespace.toLowerCase()) : true))
      .filter(({ rulesSource }) =>
        ngFilters.dataSourceName && isCloudRulesSource(rulesSource)
          ? rulesSource.name === ngFilters.dataSourceName
          : true
      )
      // If a namespace and group have rules that match the rules filters then keep them.
      .reduce(reduceNamespaces(ngFilters), [] as CombinedRuleNamespace[])
  );
};

const reduceNamespaces = (ngFilters: SearchFilterState) => {
  return (namespaceAcc: CombinedRuleNamespace[], namespace: CombinedRuleNamespace) => {
    const groups = namespace.groups
      .filter((g) => (ngFilters.groupName ? g.name.toLowerCase().includes(ngFilters.groupName.toLowerCase()) : true))
      .reduce(reduceGroups(ngFilters), [] as CombinedRuleGroup[]);

    if (groups.length) {
      namespaceAcc.push({
        ...namespace,
        groups,
      });
    }

    return namespaceAcc;
  };
};

// Reduces groups to only groups that have rules matching the filters
const reduceGroups = (ngFilters: SearchFilterState) => {
  return (groupAcc: CombinedRuleGroup[], group: CombinedRuleGroup) => {
    const rules = group.rules.filter((rule) => {
      if (ngFilters.ruleType && ngFilters.ruleType !== rule.promRule?.type) {
        return false;
      }
      if (
        ngFilters.dataSourceName &&
        isGrafanaRulerRule(rule.rulerRule) &&
        !isQueryingDataSource(rule.rulerRule, ngFilters)
      ) {
        return false;
      }

      if (ngFilters.ruleName && !rule.name?.toLocaleLowerCase().includes(ngFilters.ruleName.toLocaleLowerCase())) {
        return false;
      }
      // Query strings can match alert name, label keys, and label values
      if (ngFilters.labels.length > 0) {
        // const matchers = parseMatchers(filters.queryString);
        const matchers = ngFilters.labels.map(parseMatcher);

        const doRuleLabelsMatchQuery = matchers.length > 0 && labelsMatchMatchers(rule.labels, matchers);
        const doAlertsContainMatchingLabels =
          matchers.length > 0 &&
          rule.promRule &&
          rule.promRule.type === PromRuleType.Alerting &&
          rule.promRule.alerts &&
          rule.promRule.alerts.some((alert) => labelsMatchMatchers(alert.labels, matchers));

        if (!(doRuleLabelsMatchQuery || doAlertsContainMatchingLabels)) {
          return false;
        }
      }
      if (
        ngFilters.ruleState &&
        !(rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state === ngFilters.ruleState)
      ) {
        return false;
      }
      return true;
    });
    // Add rules to the group that match the rule list filters
    if (rules.length) {
      groupAcc.push({
        ...group,
        rules,
      });
    }
    return groupAcc;
  };
};

const isQueryingDataSource = (rulerRule: RulerGrafanaRuleDTO, ngFilter: SearchFilterState): boolean => {
  if (!ngFilter.dataSourceName) {
    return true;
  }

  return !!rulerRule.grafana_alert.data.find((query) => {
    if (!query.datasourceUid) {
      return false;
    }
    const ds = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
    return ds?.name === ngFilter.dataSourceName;
  });
};
