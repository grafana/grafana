import { renderLabels } from '../../prometheus/querybuilder/PromQueryModeller';
import {
  QueryBuilderLabelFilter,
  QueryBuilderOperationDef,
  VisualQueryModeller,
} from '../../prometheus/querybuilder/shared/types';
import { LokiVisualQuery } from './types';

export class LokiQueryModeller implements VisualQueryModeller {
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

  renderLabels(labels: QueryBuilderLabelFilter[]) {
    if (labels.length === 0) {
      return '{}';
    }

    return renderLabels(labels);
  }

  renderQuery(query: LokiVisualQuery) {
    let result = `${this.renderLabels(query.labels)}`;
    if (query.search) {
      result += ` |= "${query.search}"`;
    }

    return result;
  }
}

export const lokiQueryModeller = new LokiQueryModeller();
