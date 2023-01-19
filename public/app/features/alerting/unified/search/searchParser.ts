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
  const filterState: SearchFilterState = { labels: [], freeFormWords: [] };

  traverseNodeTree(query, (node) => {
    if (node.type.id === terms.FilterExpression) {
      const filter = getFilterFromSyntaxNode(query, node);

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
    } else if (node.type.id === terms.FreeFormExpression) {
      filterState.freeFormWords.push(getNodeContent(query, node));
    }
  });

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
  const filterStateArray: Array<{ type: number; value: string }> = [];

  // Convert filter object into an array
  // It allows to pick filters from the array in the same order as they were applied in the original query
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
  traverseNodeTree(query, (node) => {
    if (node.type.id === terms.FilterExpression && node.firstChild) {
      existingFilterNodes.push(node.firstChild);
    }
    if (node.type.id === terms.FreeFormExpression) {
      existingFilterNodes.push(node);
    }
  });

  let newQueryExpressions: string[] = [];

  // Apply filters from filterState in the same order as they appear in the search query
  // This allows to remain the order of filters in the search input during changes
  existingFilterNodes.forEach((filterNode) => {
    const matchingFilterIdx = filterStateArray.findIndex((f) => f.type === filterNode.type.id);
    if (matchingFilterIdx === -1) {
      return;
    }

    if (filterNode.parent?.type.is(terms.FilterExpression)) {
      const filterToken = filterTermToTypeMap[filterNode.type.id];
      const filterItem = filterStateArray.splice(matchingFilterIdx, 1)[0];
      newQueryExpressions.push(`${filterToken}:${getSafeFilterValue(filterItem.value)}`);
    }

    if (filterNode.type.is(terms.FreeFormExpression)) {
      const freeFormWordNode = filterStateArray.splice(matchingFilterIdx, 1)[0];
      newQueryExpressions.push(freeFormWordNode.value);
    }
  });

  // Apply new filters that were not in the query yet
  filterStateArray.forEach((fs) => {
    if (fs.type === terms.FreeFormExpression) {
      newQueryExpressions.push(fs.value);
    } else {
      newQueryExpressions.push(`${filterTermToTypeMap[fs.type]}:${getSafeFilterValue(fs.value)}`);
    }
  });

  return newQueryExpressions.join(' ');
}

function traverseNodeTree(query: string, visit: (node: SyntaxNode) => void) {
  const parsed = parser.parse(query);
  let cursor = parsed.cursor();
  do {
    visit(cursor.node);
  } while (cursor.next());
}

function getSafeFilterValue(filterValue: string) {
  const containsWhiteSpaces = /\s/.test(filterValue);
  return containsWhiteSpaces ? `\"${filterValue}\"` : filterValue;
}
