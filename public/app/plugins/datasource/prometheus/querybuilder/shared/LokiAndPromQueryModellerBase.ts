import {
  QueryBuilderLabelFilter,
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryWithOperations,
  VisualQueryModeller,
} from './types';

export interface VisualQueryBinary<T> {
  operator: string;
  vectorMatches?: string;
  query: T;
}

export abstract class LokiAndPromQueryModellerBase<T extends QueryWithOperations> implements VisualQueryModeller {
  private operations: Record<string, QueryBuilderOperationDef<T>> = {};
  private categories: string[] = [];

  protected registerOperations(operations: QueryBuilderOperationDef[]) {
    for (const op of operations) {
      this.operations[op.id] = op;
    }
  }

  protected setOperationCategories(categories: string[]) {
    this.categories = categories;
  }

  getOperationsForCategory(category: string) {
    return Object.values(this.operations).filter((op) => op.category === category && !op.hideFromList);
  }

  getAlternativeOperations(key: string) {
    return Object.values(this.operations).filter((op) => op.alternativesKey === key);
  }

  getCategories() {
    return this.categories;
  }

  getOperationDef(id: string) {
    const operation = this.operations[id];
    if (!operation) {
      throw new Error(`Operation ${id} not found`);
    }
    return operation;
  }

  renderOperations(queryString: string, operations: QueryBuilderOperation[]) {
    for (const operation of operations) {
      const def = this.operations[operation.id];
      if (!def) {
        throw new Error(`Operation ${operation.id} not found`);
      }
      queryString = def.renderer(operation, def, queryString);
    }

    return queryString;
  }

  renderBinaryQueries(queryString: string, binaryQueries?: Array<VisualQueryBinary<T>>) {
    if (binaryQueries) {
      for (const binQuery of binaryQueries) {
        queryString = `${this.renderBinaryQuery(queryString, binQuery)}`;
      }
    }
    return queryString;
  }

  private renderBinaryQuery(leftOperand: string, binaryQuery: VisualQueryBinary<T>) {
    let result = leftOperand + ` ${binaryQuery.operator} `;
    if (binaryQuery.vectorMatches) {
      result += `${binaryQuery.vectorMatches} `;
    }
    return result + `${this.renderQuery(binaryQuery.query)}`;
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

  abstract renderQuery(query: T): string;
}
