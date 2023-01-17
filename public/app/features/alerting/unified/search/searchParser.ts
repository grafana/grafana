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
  [terms.LabelFilter]: 'label',
  [terms.RuleFilter]: 'rule',
  [terms.GroupFilter]: 'group',
  [terms.StateFilter]: 'state',
  [terms.TypeFilter]: 'type',
};

export function getSearchFilterFromQuery(query: string): SearchFilterState {
  const parsed = parser.parse(query);
  const filterState: SearchFilterState = { labels: [], freeFormWords: [] };

  let cursor = parsed.cursor();
  do {
    if (cursor.node.type.id === terms.FilterExpression) {
      const filter = getFilterFromSyntaxNode(query, cursor.node);

      if (filter.type && filter.value) {
        switch (filter.type) {
          case terms.DataSourceFilter:
            filterState.dataSourceName = filter.value;
            break;
          case terms.NameSpaceFilter:
            filterState.namespace = filter.value;
            break;
          case terms.GroupFilter:
            filterState.groupName = filter.value;
            break;
          case terms.RuleFilter:
            filterState.ruleName = filter.value;
            break;
          case terms.LabelFilter:
            filterState.labels.push(filter.value);
            break;
          case terms.StateFilter:
            const state = filter.value.toLowerCase();
            if (isPromAlertingRuleState(state)) {
              filterState.ruleState = state;
            }
            break;
          case terms.TypeFilter:
            if (isPromRuleType(filter.value)) {
              filterState.ruleType = filter.value;
            }
            break;
        }
      }
    } else if (cursor.node.type.id === terms.FreeFormExpression) {
      filterState.freeFormWords.push(getNodeContent(query, cursor.node));
    }
  } while (cursor.next());

  return filterState;
}

function getFilterFromSyntaxNode(query: string, filterExpressionNode: SyntaxNode): { type?: number; value?: string } {
  if (filterExpressionNode.type.id !== terms.FilterExpression) {
    throw new Error('Invalid node provided. Only FilterExpression nodes are supported');
  }

  const filterNode = filterExpressionNode.firstChild;
  if (!filterNode) {
    return { type: undefined, value: undefined };
  }

  const filterValueNode = filterNode.getChild(terms.FilterValue);
  const filterValue = filterValueNode ? trim(getNodeContent(query, filterValueNode), '"') : undefined;

  return { type: filterNode.type.id, value: filterValue };
}

function getNodeContent(query: string, node: SyntaxNode) {
  return query.slice(node.from, node.to).trim();
}

export function applySearchFilterToQuery(query: string, filter: SearchFilterState): string {
  const parsed = parser.parse(query);

  let cursor = parsed.cursor();

  const filterStateArray: Array<{ type: number; value: string }> = [];
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
  if (filter.freeFormWords) {
    filterStateArray.push(...filter.freeFormWords.map((word) => ({ type: terms.FreeFormExpression, value: word })));
  }

  const existingFilterNodes: SyntaxNode[] = [];

  do {
    if (cursor.node.type.id === terms.FilterExpression && cursor.node.firstChild) {
      existingFilterNodes.push(cursor.node.firstChild);
    }
    if (cursor.node.type.id === terms.FreeFormExpression) {
      existingFilterNodes.push(cursor.node);
    }
  } while (cursor.next());

  let newQueryExpressions: string[] = [];

  existingFilterNodes.map((filterNode) => {
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
    if (fs.type === terms.FreeFormExpression) {
      newQueryExpressions.push(fs.value);
    } else {
      newQueryExpressions.push(`${filterTermToTypeMap[fs.type]}:${getSafeFilterValue(fs.value)}`);
    }
  });

  return newQueryExpressions.join(' ');
}

function getSafeFilterValue(filterValue: string) {
  const containsWhiteSpaces = /\s/.test(filterValue);
  return containsWhiteSpaces ? `\"${filterValue}\"` : filterValue;
}
