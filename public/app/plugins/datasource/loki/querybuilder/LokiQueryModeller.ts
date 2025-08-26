import {
  QueryModellerBase,
  QueryBuilderLabelFilter,
  VisualQuery,
  QueryBuilderOperation,
  VisualQueryBinary,
} from '@grafana/plugin-ui';

import { operationDefinitions } from './operations';
import { LokiOperationId, LokiQueryPattern, LokiQueryPatternType, LokiVisualQueryOperationCategory } from './types';

export class LokiQueryModeller extends QueryModellerBase {
  constructor() {
    super(operationDefinitions, '<expr>');

    this.setOperationCategories([
      LokiVisualQueryOperationCategory.Aggregations,
      LokiVisualQueryOperationCategory.RangeFunctions,
      LokiVisualQueryOperationCategory.Formats,
      LokiVisualQueryOperationCategory.BinaryOps,
      LokiVisualQueryOperationCategory.LabelFilters,
      LokiVisualQueryOperationCategory.LineFilters,
    ]);
  }

  renderOperations(queryString: string, operations: QueryBuilderOperation[]): string {
    for (const operation of operations) {
      if (operation.disabled) {
        continue;
      }
      const def = this.operationsRegistry.getIfExists(operation.id);
      if (!def) {
        console.error(`Could not find operation ${operation.id} in the registry`);
        continue;
      }
      queryString = def.renderer(operation, def, queryString);
    }
    return queryString;
  }

  renderBinaryQueries(queryString: string, binaryQueries?: Array<VisualQueryBinary<VisualQuery>>) {
    if (binaryQueries) {
      for (const binQuery of binaryQueries) {
        queryString = `${this.renderBinaryQuery(queryString, binQuery)}`;
      }
    }
    return queryString;
  }

  private renderBinaryQuery(leftOperand: string, binaryQuery: VisualQueryBinary<VisualQuery>) {
    let result = leftOperand + ` ${binaryQuery.operator} `;

    if (binaryQuery.vectorMatches) {
      result += `${binaryQuery.vectorMatchesType}(${binaryQuery.vectorMatches}) `;
    }

    return result + this.renderQuery(binaryQuery.query, true);
  }

  renderLabels(labels: QueryBuilderLabelFilter[]): string {
    if (labels.length === 0) {
      return '{}';
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

  renderQuery(query: VisualQuery, nested?: boolean): string {
    let queryString = this.renderLabels(query.labels);
    queryString = this.renderOperations(queryString, query.operations);

    if (!nested && this.hasBinaryOp(query) && Boolean(query.binaryQueries?.length)) {
      queryString = `(${queryString})`;
    }

    queryString = this.renderBinaryQueries(queryString, query.binaryQueries);

    return queryString;
  }

  getQueryPatterns(): LokiQueryPattern[] {
    return [
      {
        name: 'Parse log lines with logfmt parser',
        type: LokiQueryPatternType.Log,
        // {} | logfmt | __error__=``
        operations: [
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
        ],
      },
      {
        name: 'Parse log lines with JSON parser',
        type: LokiQueryPatternType.Log,
        // {} | json | __error__=``
        operations: [
          { id: LokiOperationId.Json, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
        ],
      },
      {
        name: 'Filter log line and parse with logfmt parser',
        type: LokiQueryPatternType.Log,
        // {} |= `` | logfmt | __error__=``
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
        ],
      },
      {
        name: 'Filter log lines and parse with json parser',
        type: LokiQueryPatternType.Log,
        // {} |= `` | json | __error__=``
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.Json, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
        ],
      },
      {
        name: 'Parse log line with logfmt parser and use label filter',
        type: LokiQueryPatternType.Log,
        // {} |= `` | logfmt | __error__=`` | label=`value`
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.LabelFilter, params: ['label', '=', 'value'] },
        ],
      },
      {
        name: 'Parse log lines with nested json',
        type: LokiQueryPatternType.Log,
        // {} |= `` | json | line_format `{{ .message}}` | json
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.Json, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.LineFormat, params: ['{{.message}}'] },
          { id: LokiOperationId.Json, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
        ],
      },
      {
        name: 'Reformat log lines',
        type: LokiQueryPatternType.Log,
        // {} |= `` | logfmt | line_format `{{.message}}`
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.LineFormat, params: ['{{.message}}'] },
        ],
      },
      {
        name: 'Rename lvl label to level',
        type: LokiQueryPatternType.Log,
        // {} |= `` | logfmt | label_format level=lvl
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.LabelFormat, params: ['lvl', 'level'] },
        ],
      },
      {
        name: 'Query on value inside a log line',
        type: LokiQueryPatternType.Metric,
        // sum(sum_over_time({ | logfmt | __error__=`` | unwrap | __error__=`` [$__auto]))
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.Unwrap, params: [''] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.SumOverTime, params: ['$__auto'] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      },
      {
        name: 'Total requests per label of streams',
        type: LokiQueryPatternType.Metric,
        // sum by() (count_over_time({}[$__auto)
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.CountOverTime, params: ['$__auto'] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      },
      {
        name: 'Total requests per parsed label or label of streams',
        type: LokiQueryPatternType.Metric,
        // sum by() (count_over_time({}| logfmt | __error__=`` [$__auto))
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.CountOverTime, params: ['$__auto'] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      },
      {
        name: 'Bytes used by a log stream',
        type: LokiQueryPatternType.Metric,
        // bytes_over_time({}[$__auto])
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.BytesOverTime, params: ['$__auto'] },
        ],
      },
      {
        name: 'Count of log lines per stream',
        type: LokiQueryPatternType.Metric,
        // count_over_time({}[$__auto])
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.CountOverTime, params: ['$__auto'] },
        ],
      },
      {
        name: 'Top N results by label or parsed label',
        type: LokiQueryPatternType.Metric,
        // topk(10, sum by () (count_over_time({} | logfmt | __error__=`` [$__auto])))
        operations: [
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.CountOverTime, params: ['$__auto'] },
          { id: LokiOperationId.Sum, params: [] },
          { id: LokiOperationId.TopK, params: [10] },
        ],
      },
      {
        name: 'Extracted quantile',
        type: LokiQueryPatternType.Metric,
        // quantile_over_time(0.5,{} | logfmt | unwrap latency[$__auto]) by ()
        operations: [
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.Unwrap, params: ['latency'] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.QuantileOverTime, params: ['$__auto', 0.5] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      },
    ];
  }
}

export const lokiQueryModeller = new LokiQueryModeller();
