import { useMemo } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { CombinedRuleGroup, CombinedRuleNamespace, FilterState } from 'app/types/unified-alerting';
import { PromRuleType, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { parser } from '../search/search';
import * as terms from '../search/search.terms';
import { labelsMatchMatchers, parseMatchers } from '../utils/alertmanager';
import { isCloudRulesSource } from '../utils/datasource';
import { getFiltersFromUrlParams } from '../utils/misc';
import { isAlertingRule, isGrafanaRulerRule } from '../utils/rules';

enum FilterType {
  ns = 'ns',
  group = 'group',
  rule = 'rule',
  state = 'state', // Firing | Normal | Pending
  type = 'type', // Alerting | Recording
  ds = 'ds',
}

function isFilterType(filterType: string): filterType is FilterType {
  return Object.values<string>(FilterType).includes(filterType);
}

export const useFilteredRules = (namespaces: CombinedRuleNamespace[]) => {
  const [queryParams] = useQueryParams();
  const filters = getFiltersFromUrlParams(queryParams);

  const freeFormQuery = filters.queryString ?? '';
  const parsed = parser.parse(freeFormQuery);

  const parsedFilters: Array<{ type: FilterType; value: string }> = [];
  let cursor = parsed.cursor();
  do {
    // console.log(`Node ${cursor.name} from ${cursor.from} to ${cursor.to}`);
    if (cursor.node.type.id === terms.FilterExpression) {
      const typeNode = cursor.node.getChild(terms.FilterType);
      const valueNode = cursor.node.getChild(terms.FilterValue);

      if (typeNode && valueNode) {
        const filterType = freeFormQuery.substring(typeNode.from, typeNode.to);
        const filterValue = freeFormQuery.substring(valueNode.from, valueNode.to);

        if (isFilterType(filterType)) {
          parsedFilters.push({
            type: filterType,
            value: filterValue,
          });
        }
      }
      // console.log('Type & Value: ', typeNode, valueNode);
    }
  } while (cursor.next());

  console.log(parsedFilters);

  return useMemo(() => filterRules(namespaces, filters), [namespaces, filters]);
};

export const filterRules = (namespaces: CombinedRuleNamespace[], filters: FilterState): CombinedRuleNamespace[] => {
  return (
    namespaces
      .filter(({ rulesSource }) =>
        filters.dataSource && isCloudRulesSource(rulesSource) ? rulesSource.name === filters.dataSource : true
      )
      // If a namespace and group have rules that match the rules filters then keep them.
      .reduce(reduceNamespaces(filters), [] as CombinedRuleNamespace[])
  );
};

const reduceNamespaces = (filters: FilterState) => {
  return (namespaceAcc: CombinedRuleNamespace[], namespace: CombinedRuleNamespace) => {
    const groups = namespace.groups.reduce(reduceGroups(filters), [] as CombinedRuleGroup[]);

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
const reduceGroups = (filters: FilterState) => {
  return (groupAcc: CombinedRuleGroup[], group: CombinedRuleGroup) => {
    const rules = group.rules.filter((rule) => {
      if (filters.ruleType && filters.ruleType !== rule.promRule?.type) {
        return false;
      }
      if (filters.dataSource && isGrafanaRulerRule(rule.rulerRule) && !isQueryingDataSource(rule.rulerRule, filters)) {
        return false;
      }
      // Query strings can match alert name, label keys, and label values
      if (filters.queryString) {
        const normalizedQueryString = filters.queryString.toLocaleLowerCase();
        const doesNameContainsQueryString = rule.name?.toLocaleLowerCase().includes(normalizedQueryString);
        const matchers = parseMatchers(filters.queryString);

        const doRuleLabelsMatchQuery = matchers.length > 0 && labelsMatchMatchers(rule.labels, matchers);
        const doAlertsContainMatchingLabels =
          matchers.length > 0 &&
          rule.promRule &&
          rule.promRule.type === PromRuleType.Alerting &&
          rule.promRule.alerts &&
          rule.promRule.alerts.some((alert) => labelsMatchMatchers(alert.labels, matchers));

        if (!(doesNameContainsQueryString || doRuleLabelsMatchQuery || doAlertsContainMatchingLabels)) {
          return false;
        }
      }
      if (
        filters.alertState &&
        !(rule.promRule && isAlertingRule(rule.promRule) && rule.promRule.state === filters.alertState)
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

const isQueryingDataSource = (rulerRule: RulerGrafanaRuleDTO, filter: FilterState): boolean => {
  if (!filter.dataSource) {
    return true;
  }

  return !!rulerRule.grafana_alert.data.find((query) => {
    if (!query.datasourceUid) {
      return false;
    }
    const ds = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
    return ds?.name === filter.dataSource;
  });
};
