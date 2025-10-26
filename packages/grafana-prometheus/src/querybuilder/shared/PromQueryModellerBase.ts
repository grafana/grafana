// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/LokiAndPromQueryModellerBase.ts
import { Registry } from '@grafana/data';

import { renderLabels } from './rendering/labels';
import { hasBinaryOp, renderOperations } from './rendering/operations';
import { renderQuery, renderBinaryQueries } from './rendering/query';
import {
  PrometheusVisualQuery,
  QueryBuilderLabelFilter,
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  VisualQueryBinary,
  VisualQueryModeller,
} from './types';

export abstract class PromQueryModellerBase implements VisualQueryModeller {
  protected operationsRegistry: Registry<QueryBuilderOperationDef>;
  private categories: string[] = [];
  private operationsMapCache: Map<string, QueryBuilderOperationDef> | null = null;

  constructor(getOperations: () => QueryBuilderOperationDef[]) {
    this.operationsRegistry = new Registry<QueryBuilderOperationDef>(getOperations);
  }

  private getOperationsMap(): Map<string, QueryBuilderOperationDef> {
    if (!this.operationsMapCache) {
      this.operationsMapCache = new Map<string, QueryBuilderOperationDef>();
      this.operationsRegistry.list().forEach((op) => {
        this.operationsMapCache!.set(op.id, op);
      });
    }
    return this.operationsMapCache;
  }

  protected setOperationCategories(categories: string[]) {
    this.categories = categories;
  }

  getOperationsForCategory(category: string) {
    return this.operationsRegistry.list().filter((op) => op.category === category && !op.hideFromList);
  }

  getAlternativeOperations(key: string) {
    return this.operationsRegistry.list().filter((op) => op.alternativesKey && op.alternativesKey === key);
  }

  getCategories() {
    return this.categories;
  }

  getOperationDef(id: string): QueryBuilderOperationDef | undefined {
    return this.operationsRegistry.getIfExists(id);
  }

  renderOperations(queryString: string, operations: QueryBuilderOperation[]) {
    return renderOperations(queryString, operations, this.getOperationsMap());
  }

  renderBinaryQueries(queryString: string, binaryQueries?: Array<VisualQueryBinary<PrometheusVisualQuery>>) {
    return renderBinaryQueries(queryString, binaryQueries);
  }

  renderLabels(labels: QueryBuilderLabelFilter[]) {
    return renderLabels(labels);
  }

  renderQuery(query: PrometheusVisualQuery, nested?: boolean) {
    return renderQuery(query, nested, this.getOperationsMap());
  }

  hasBinaryOp(query: PrometheusVisualQuery): boolean {
    return hasBinaryOp(query, this.getOperationsMap());
  }
}
