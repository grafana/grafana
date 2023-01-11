import { SyntaxNode } from '@lezer/common';
import { trim } from 'lodash';

import { isPromAlertingRuleState, PromAlertingRuleState, PromRuleType } from '../../../../types/unified-alerting-dto';
import { isPromRuleType } from '../utils/rules';

import { parser } from './search';
import * as terms from './search.terms';

export interface SearchFilterState {
  freeFormWords: string[];
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

export function getSearchFilterFromQuery(query: string): SearchFilterState {
  const parsed = parser.parse(query);

  const filterState: SearchFilterState = { labels: [], freeFormWords: [] };

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
      filterState.freeFormWords.push(query.slice(cursor.node.from, cursor.node.to));
    }
  } while (cursor.next());

  return filterState;
}

export function applySearchFilterToQuery(query: string, filter: SearchFilterState): string {
  const parsed = parser.parse(query);

  let cursor = parsed.cursor();

  const filterStateArray: Array<{ type: number; value: string }> = [];
  if (filter.freeFormWords) {
    filterStateArray.push(...filter.freeFormWords.map((word) => ({ type: terms.FreeFormExpression, value: word })));
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
    if (cursor.node.type.id === terms.FreeFormExpression) {
      existingTreeFilters.push(cursor.node);
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
    } else if (matchingFilterIdx !== -1 && filterNode.node.type.id === terms.FreeFormExpression) {
      const freeFormWordNode = filterStateArray.splice(matchingFilterIdx, 1)[0];
      newQueryExpressions.push(freeFormWordNode.value);
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
