// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/LokiAndPromQueryModellerBase.ts
import { Registry } from '@grafana/data';
import { config } from '@grafana/runtime';

import { prometheusRegularEscape } from '../../datasource';
import { isValidLegacyName, utf8Support } from '../../utf8_support';
import { PromVisualQueryOperationCategory } from '../types';

import { QueryBuilderLabelFilter, QueryBuilderOperation, QueryBuilderOperationDef, VisualQueryModeller } from './types';

export interface VisualQueryBinary<T> {
  operator: string;
  vectorMatchesType?: 'on' | 'ignoring';
  vectorMatches?: string;
  query: T;
}

export interface PromLokiVisualQuery {
  metric?: string;
  labels: QueryBuilderLabelFilter[];
  operations: QueryBuilderOperation[];
  binaryQueries?: Array<VisualQueryBinary<PromLokiVisualQuery>>;
}

export abstract class LokiAndPromQueryModellerBase implements VisualQueryModeller {
  protected operationsRegistry: Registry<QueryBuilderOperationDef>;
  private categories: string[] = [];

  constructor(getOperations: () => QueryBuilderOperationDef[]) {
    this.operationsRegistry = new Registry<QueryBuilderOperationDef>(getOperations);
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
    for (const operation of operations) {
      const def = this.operationsRegistry.getIfExists(operation.id);
      if (!def) {
        throw new Error(`Could not find operation ${operation.id} in the registry`);
      }
      queryString = def.renderer(operation, def, queryString);
    }

    return queryString;
  }

  renderBinaryQueries(queryString: string, binaryQueries?: Array<VisualQueryBinary<PromLokiVisualQuery>>) {
    if (binaryQueries) {
      for (const binQuery of binaryQueries) {
        queryString = `${this.renderBinaryQuery(queryString, binQuery)}`;
      }
    }
    return queryString;
  }

  private renderBinaryQuery(leftOperand: string, binaryQuery: VisualQueryBinary<PromLokiVisualQuery>) {
    let result = leftOperand + ` ${binaryQuery.operator} `;

    if (binaryQuery.vectorMatches) {
      result += `${binaryQuery.vectorMatchesType}(${binaryQuery.vectorMatches}) `;
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

      let labelValue = filter.value;
      const usingRegexOperator = filter.op === '=~' || filter.op === '!~';

      if (config.featureToggles.prometheusSpecialCharsInLabelValues && !usingRegexOperator) {
        labelValue = prometheusRegularEscape(labelValue);
      }
      expr += `${utf8Support(filter.label)}${filter.op}"${labelValue}"`;
    }

    return expr + `}`;
  }

  renderQuery(query: PromLokiVisualQuery, nested?: boolean) {
    let queryString = '';
    const labels = this.renderLabels(query.labels);
    if (query.metric) {
      if (isValidLegacyName(query.metric)) {
        // This is a legacy metric, put outside the curl legacy_query{label="value"}
        queryString = `${query.metric}${labels}`;
      } else {
        // This is a utf8 metric, put inside the curly and quotes {"utf8.metric", label="value"}
        queryString = `{"${query.metric}"${labels.length > 0 ? `, ${labels.substring(1)}` : `}`}`;
      }
    } else {
      // No metric just use labels {label="value"}
      queryString = labels;
    }

    queryString = this.renderOperations(queryString, query.operations);

    if (!nested && this.hasBinaryOp(query) && Boolean(query.binaryQueries?.length)) {
      queryString = `(${queryString})`;
    }

    queryString = this.renderBinaryQueries(queryString, query.binaryQueries);

    if (nested && (this.hasBinaryOp(query) || Boolean(query.binaryQueries?.length))) {
      queryString = `(${queryString})`;
    }

    return queryString;
  }

  hasBinaryOp(query: PromLokiVisualQuery): boolean {
    return (
      query.operations.find((op) => {
        const def = this.getOperationDef(op.id);
        return def?.category === PromVisualQueryOperationCategory.BinaryOps;
      }) !== undefined
    );
  }
}
