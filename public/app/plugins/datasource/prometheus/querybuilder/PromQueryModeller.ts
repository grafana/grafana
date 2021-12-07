import { getAggregationOperations } from './aggregations';
import { getOperationDefintions } from './operations';
import { VisualQueryModeller, QueryBuilderOperationDef, QueryBuilderLabelFilter } from './shared/types';
import { PromQueryPattern, PromVisualQuery, PromVisualQueryBinary, PromVisualQueryOperationCategory } from './types';

export class PromQueryModeller implements VisualQueryModeller {
  private operations: Record<string, QueryBuilderOperationDef<PromVisualQuery>> = {};

  constructor() {
    const allOperations = getOperationDefintions().concat(getAggregationOperations());

    for (const op of allOperations) {
      this.operations[op.id] = op;
    }
  }

  getOperationsForCategory(category: PromVisualQueryOperationCategory) {
    return Object.values(this.operations).filter((op) => op.category === category && !op.hideFromList);
  }

  getOperationDef(id: string) {
    const operation = this.operations[id];
    if (!operation) {
      throw new Error(`Operation ${id} not found`);
    }
    return operation;
  }

  getCategories() {
    return [
      PromVisualQueryOperationCategory.Aggregations,
      PromVisualQueryOperationCategory.RateAndDeltas,
      PromVisualQueryOperationCategory.Functions,
      PromVisualQueryOperationCategory.Math,
    ];
  }

  renderQuery(query: PromVisualQuery) {
    let queryString = `${query.metric}${renderLabels(query.labels)}`;

    for (const operation of query.operations) {
      const def = this.operations[operation.id];
      if (!def) {
        throw new Error(`Operation ${operation.id} not found`);
      }
      queryString = def.renderer(operation, def, queryString);
    }

    if (query.binaryQueries) {
      for (const binaryQueries of query.binaryQueries) {
        queryString = `${this.renderBinaryQuery(queryString, binaryQueries)}`;
      }
    }

    return queryString;
  }

  renderLabels(labels: QueryBuilderLabelFilter[]) {
    return renderLabels(labels);
  }

  renderBinaryQuery(leftOperand: string, binaryQuery: PromVisualQueryBinary) {
    let result = leftOperand + ` ${binaryQuery.operator} `;
    if (binaryQuery.vectorMatches) {
      result += `${binaryQuery.vectorMatches} `;
    }
    return result + `${this.renderQuery(binaryQuery.query)}`;
  }

  getQueryPatterns(): PromQueryPattern[] {
    return [
      {
        name: 'Rate then sum',
        operations: [{ id: 'rate', params: ['auto'] }],
      },
      {
        name: 'Rate then sum by(label) then avg',
        operations: [
          { id: 'rate', params: ['auto'] },
          { id: '__sum_by', params: [''] },
          { id: 'avg', params: [] },
        ],
      },
      {
        name: 'Histogram quantile on rate',
        operations: [
          { id: 'rate', params: ['auto'] },
          { id: '__sum_by', params: ['le'] },
          { id: 'histogram_quantile', params: [0.95] },
        ],
      },
    ];
  }
}

export function renderLabels(labels: QueryBuilderLabelFilter[]) {
  if (labels.length === 0) {
    return '';
  }

  let expr = '{';
  for (const filter of labels) {
    if (expr !== '{') {
      expr += ', ';
    }

    expr += `${filter.label}${filter.op}"${filter.value}"`;
  }

  return expr + `}`;
}

export const promQueryModeller = new PromQueryModeller();
