import { getAggregationOperations } from './aggregations';
import { getOperationDefintions } from './operations';
import { VisualQueryModeller, QueryBuilderOperationDef, QueryBuilderLabelFilter } from './shared/types';
import { PromVisualQuery, PromVisualQueryOperationCategory } from './types';

export class PromQueryModeller implements VisualQueryModeller {
  private operations: Record<string, QueryBuilderOperationDef<PromVisualQuery>> = {};

  constructor() {
    const allOperations = getOperationDefintions().concat(getAggregationOperations());

    for (const op of allOperations) {
      this.operations[op.id] = op;
    }
  }

  getOperationsForCategory(category: PromVisualQueryOperationCategory) {
    return Object.values(this.operations).filter((op) => op.category === category);
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
      PromVisualQueryOperationCategory.GroupBy,
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
}

export const promQueryModeller = new PromQueryModeller();
