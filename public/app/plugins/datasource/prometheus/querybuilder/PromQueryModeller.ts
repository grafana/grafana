import { getAggregationOperations } from './aggregations';
import { getOperationDefintions } from './operations';
import { VisualQueryModeller, QueryBuilderOperationDef, QueryBuilderLabelFilter } from './shared/types';
import { PromQueryPattern, PromVisualQuery, PromVisualQueryOperationCategory } from './types';

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
    let queryString = `${query.metric}${this.renderLabels(query.labels)}`;

    for (const operation of query.operations) {
      const def = this.operations[operation.id];
      if (!def) {
        throw new Error(`Operation ${operation.id} not found`);
      }
      queryString = def.renderer(operation, def, queryString);
    }

    return queryString;
  }

  renderLabels(labels: QueryBuilderLabelFilter[]) {
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

  getQueryPatterns(): PromQueryPattern[] {
    return [
      {
        name: 'Rate then Sum',
        operations: [{ id: 'rate', params: ['auto'] }],
      },
      {
        name: 'Rate then Sum by(label)',
        operations: [
          { id: 'rate', params: ['auto'] },
          { id: '__sum_by', params: [''] },
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

export const promQueryModeller = new PromQueryModeller();
