import { SyntaxNode } from '@lezer/common';
import { trim } from 'lodash';

import { parser } from './search';
import * as terms from './search.terms';

const filterTokenToTypeMap: Record<number, string> = {
  [terms.DataSourceToken]: 'datasource',
  [terms.NameSpaceToken]: 'namespace',
  [terms.LabelToken]: 'label',
  [terms.RuleToken]: 'rule',
  [terms.GroupToken]: 'group',
  [terms.StateToken]: 'state',
  [terms.TypeToken]: 'type',
  [terms.HealthToken]: 'health',
  [terms.DashboardToken]: 'dashboard',
  [terms.PluginsToken]: 'plugins',
  [terms.ContactPointToken]: 'contactPoint',
  [terms.RuleSourceToken]: 'source',
};

// This enum allows to configure parser behavior
// Depending on our needs we can enable and disable only selected filters
// Thanks to that we can create multiple different filters having the same search grammar
export enum FilterSupportedTerm {
  dataSource = 'dataSourceFilter',
  nameSpace = 'nameSpaceFilter',
  label = 'labelFilter',
  group = 'groupFilter',
  rule = 'ruleFilter',
  state = 'stateFilter',
  type = 'typeFilter',
  health = 'healthFilter',
  dashboard = 'dashboardFilter',
  plugins = 'pluginsFilter',
  contactPoint = 'contactPointFilter',
  source = 'sourceFilter',
}

export type QueryFilterMapper = Record<number, (filter: string) => void>;

export interface FilterExpr {
  type: number;
  value: string;
}

export function parseQueryToFilter(
  query: string,
  supportedTerms: FilterSupportedTerm[],
  filterMapper: QueryFilterMapper
) {
  traverseNodeTree(query, supportedTerms, (node) => {
    if (node.type.id === terms.FilterExpression) {
      const filter = getFilterFromSyntaxNode(query, node);

      if (filter.type && filter.value) {
        const filterHandler = filterMapper[filter.type];
        if (filterHandler) {
          filterHandler(filter.value);
        }
      }
    } else if (node.type.id === terms.FreeFormExpression) {
      const filterHandler = filterMapper[terms.FreeFormExpression];
      if (filterHandler) {
        filterHandler(getNodeContent(query, node));
      }
    }
  });
}

function getFilterFromSyntaxNode(query: string, filterExpressionNode: SyntaxNode): { type?: number; value?: string } {
  if (filterExpressionNode.type.id !== terms.FilterExpression) {
    throw new Error('Invalid node provided. Only FilterExpression nodes are supported');
  }

  const filterTokenNode = filterExpressionNode.firstChild;
  if (!filterTokenNode) {
    return { type: undefined, value: undefined };
  }

  const filterValueNode = filterExpressionNode.getChild(terms.FilterValue);
  const filterValue = filterValueNode ? trim(getNodeContent(query, filterValueNode), '"') : undefined;

  return { type: filterTokenNode.type.id, value: filterValue };
}

function getNodeContent(query: string, node: SyntaxNode) {
  return query.slice(node.from, node.to).trim().replace(/\"/g, '');
}

export function applyFiltersToQuery(
  query: string,
  supportedTerms: FilterSupportedTerm[],
  filters: FilterExpr[]
): string {
  const existingFilterNodes: SyntaxNode[] = [];
  traverseNodeTree(query, supportedTerms, (node) => {
    if (node.type.id === terms.FilterExpression && node.firstChild) {
      existingFilterNodes.push(node.firstChild);
    }
    if (node.type.id === terms.FreeFormExpression) {
      existingFilterNodes.push(node);
    }
  });

  const newQueryExpressions: string[] = [];

  // Apply filters from filterState in the same order as they appear in the search query
  // This allows to remain the order of filters in the search input during changes
  existingFilterNodes.forEach((filterNode) => {
    const matchingFilterIdx = filters.findIndex((f) => f.type === filterNode.type.id);
    if (matchingFilterIdx === -1) {
      return;
    }

    if (filterNode.parent?.type.is(terms.FilterExpression)) {
      const filterToken = filterTokenToTypeMap[filterNode.type.id];
      const filterItem = filters.splice(matchingFilterIdx, 1)[0];
      newQueryExpressions.push(`${filterToken}:${getSafeFilterValue(filterItem.value)}`);
    }

    if (filterNode.type.is(terms.FreeFormExpression)) {
      const freeFormWordNode = filters.splice(matchingFilterIdx, 1)[0];
      newQueryExpressions.push(freeFormWordNode.value);
    }
  });

  // Apply new filters that hasn't been in the query yet
  filters.forEach((fs) => {
    if (fs.type === terms.FreeFormExpression) {
      newQueryExpressions.push(fs.value);
    } else {
      newQueryExpressions.push(`${filterTokenToTypeMap[fs.type]}:${getSafeFilterValue(fs.value)}`);
    }
  });

  return newQueryExpressions.join(' ');
}

function traverseNodeTree(query: string, supportedTerms: FilterSupportedTerm[], visit: (node: SyntaxNode) => void) {
  const dialect = supportedTerms.join(' ');
  const parsed = parser.configure({ dialect }).parse(query);
  const cursor = parsed.cursor();
  do {
    visit(cursor.node);
  } while (cursor.next());
}

function getSafeFilterValue(filterValue: string) {
  const containsWhiteSpaces = /\s/.test(filterValue);
  return containsWhiteSpaces ? `\"${filterValue}\"` : filterValue;
}
