import { Registry } from '@grafana/data';
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
  protected operationsRegisty: Registry<QueryBuilderOperationDef>;
  private categories: string[] = [];

  constructor(getOperations: () => QueryBuilderOperationDef[]) {
    this.operationsRegisty = new Registry<QueryBuilderOperationDef>(getOperations);
  }

  protected setOperationCategories(categories: string[]) {
    this.categories = categories;
  }

  getOperationsForCategory(category: string) {
    return this.operationsRegisty.list().filter((op) => op.category === category && !op.hideFromList);
  }

  getAlternativeOperations(key: string) {
    return this.operationsRegisty.list().filter((op) => op.alternativesKey === key);
  }

  getCategories() {
    return this.categories;
  }

  getOperationDef(id: string): QueryBuilderOperationDef | undefined {
    return this.operationsRegisty.getIfExists(id);
  }

  renderOperations(queryString: string, operations: QueryBuilderOperation[]) {
    for (const operation of operations) {
      const def = this.operationsRegisty.getIfExists(operation.id);
      if (!def) {
        throw new Error(`Could not find operation ${operation.id} in the registry`);
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

    return result + this.renderQuery(binaryQuery.query, true);
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

  abstract renderQuery(query: T, nested?: boolean): string;
}
