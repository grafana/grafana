import { LokiAndPromQueryModellerBase } from '../../prometheus/querybuilder/shared/LokiAndPromQueryModellerBase';
import { QueryBuilderLabelFilter } from '../../prometheus/querybuilder/shared/types';

import { getOperationDefinitions } from './operations';
import { LokiOperationId, LokiQueryPattern, LokiQueryPatternType, LokiVisualQueryOperationCategory } from './types';

export class LokiQueryModeller extends LokiAndPromQueryModellerBase {
  constructor() {
    super(getOperationDefinitions);

    this.setOperationCategories([
      LokiVisualQueryOperationCategory.Aggregations,
      LokiVisualQueryOperationCategory.RangeFunctions,
      LokiVisualQueryOperationCategory.Formats,
      LokiVisualQueryOperationCategory.BinaryOps,
      LokiVisualQueryOperationCategory.LabelFilters,
      LokiVisualQueryOperationCategory.LineFilters,
    ]);
  }

  renderLabels(labels: QueryBuilderLabelFilter[]) {
    if (labels.length === 0) {
      return '{}';
    }

    return super.renderLabels(labels);
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
        // sum(sum_over_time({ | logfmt | __error__=`` | unwrap | __error__=`` [$__interval]))
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.Unwrap, params: [''] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.SumOverTime, params: ['$__interval'] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      },
      {
        name: 'Total requests per label of streams',
        type: LokiQueryPatternType.Metric,
        // sum by() (count_over_time({}[$__interval)
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.CountOverTime, params: ['$__interval'] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      },
      {
        name: 'Total requests per parsed label or label of streams',
        type: LokiQueryPatternType.Metric,
        // sum by() (count_over_time({}| logfmt | __error__=`` [$__interval))
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.CountOverTime, params: ['$__interval'] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      },
      {
        name: 'Bytes used by a log stream',
        type: LokiQueryPatternType.Metric,
        // bytes_over_time({}[$__interval])
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.BytesOverTime, params: ['$__interval'] },
        ],
      },
      {
        name: 'Count of log lines per stream',
        type: LokiQueryPatternType.Metric,
        // count_over_time({}[$__interval])
        operations: [
          { id: LokiOperationId.LineContains, params: [''] },
          { id: LokiOperationId.CountOverTime, params: ['$__interval'] },
        ],
      },
      {
        name: 'Top N results by label or parsed label',
        type: LokiQueryPatternType.Metric,
        // topk(10, sum by () (count_over_time({} | logfmt | __error__=`` [$__interval])))
        operations: [
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.CountOverTime, params: ['$__interval'] },
          { id: LokiOperationId.Sum, params: [] },
          { id: LokiOperationId.TopK, params: [10] },
        ],
      },
      {
        name: 'Extracted quantile',
        type: LokiQueryPatternType.Metric,
        // quantile_over_time(0.5,{} | logfmt | unwrap latency[$__interval]) by ()
        operations: [
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.Unwrap, params: ['latency'] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.QuantileOverTime, params: ['$__interval', 0.5] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      },
    ];
  }
}

export const lokiQueryModeller = new LokiQueryModeller();
