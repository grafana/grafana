import { getOperationDefintions } from './operations';
import { QueryBuilderOperationDef } from './shared/types';
import { PromVisualQuery, PromVisualQueryOperationCategory } from './types';

export class VisualQueryEngine {
  private operations: Record<string, QueryBuilderOperationDef<PromVisualQuery>> = {};

  constructor() {
    for (const op of getOperationDefintions()) {
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
    let queryString = `${query.metric}${this.renderLabels(query)}`;

    for (const operation of query.operations) {
      const def = this.operations[operation.id];
      if (!def) {
        throw new Error(`Operation ${operation.id} not found`);
      }
      queryString = def.renderer(operation, def, queryString);
    }

    return queryString;
  }

  renderLabels(query: PromVisualQuery) {
    if (query.labels.length === 0) {
      return '';
    }

    let expr = '{';
    for (const filter of query.labels) {
      if (expr !== '{') {
        expr += ', ';
      }

      expr += `${filter.label}${filter.op}"${filter.value}"`;
    }

    return expr + `}`;
  }
}

export const visualQueryEngine = new VisualQueryEngine();
