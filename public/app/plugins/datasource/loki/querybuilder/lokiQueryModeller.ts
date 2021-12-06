import { QueryBuilderOperationDef } from '../../prometheus/querybuilder/shared/types';
import { LokiVisualQuery } from './types';

export class LokiQueryModeller {
  private operations: Record<string, QueryBuilderOperationDef<LokiVisualQuery>> = {};

  constructor() {}

  getOperationsForCategory(category: string) {
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
    return ['Stuff'];
  }

  renderQuery(query: LokiVisualQuery) {
    return '';
  }

  renderLabels(query: LokiVisualQuery) {
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

export const lokiQueryModeller = new LokiQueryModeller();
