import { trim } from 'lodash';
import { useMemo } from 'react';

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

interface SearchFilterState {
  query?: string;
  namespace?: string;
  groupName?: string;
  ruleName?: string;
  ruleState?: PromAlertingRuleState; // Unify somehow with Prometheus rules
  ruleType?: PromRuleType;
  dataSourceName?: string;
  labels: string[];
}

function isPromRuleType(ruleType: string): ruleType is PromRuleType {
  return Object.values<string>(PromRuleType).includes(ruleType);
}

function getSearchFilterFromQuery(query: string): SearchFilterState {
  const parsed = parser.parse(query);

  const filterState: SearchFilterState = { labels: [] };

  let cursor = parsed.cursor();
  do {
    if (cursor.node.type.id === terms.FilterExpression) {
      const valueNode = cursor.node.firstChild?.getChild(terms.FilterValue);
      const filterValue = valueNode ? trim(query.substring(valueNode.from, valueNode.to), '"') : undefined;

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

export function useRulesFilter() {
  const [queryParams] = useURLSearchParams();
  const queryString = queryParams.get('queryString') ?? '';

  const filters = getSearchFilterFromQuery(queryString);

  return { filters, queryString };
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
