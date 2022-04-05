import { LokiAndPromQueryModellerBase } from '../../prometheus/querybuilder/shared/LokiAndPromQueryModellerBase';
import { QueryBuilderLabelFilter } from '../../prometheus/querybuilder/shared/types';
import { getOperationDefinitions } from './operations';
import { LokiOperationId, LokiQueryPattern, LokiVisualQueryOperationCategory } from './types';

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
        name: 'Log query and label filter',
        operations: [
          { id: LokiOperationId.LineMatchesRegex, params: [''] },
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.LabelFilter, params: ['', '=', ''] },
        ],
      },
      {
        name: 'Time series query on value inside log line',
        operations: [
          { id: LokiOperationId.LineMatchesRegex, params: [''] },
          { id: LokiOperationId.Logfmt, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
          { id: LokiOperationId.Unwrap, params: [''] },
          { id: LokiOperationId.SumOverTime, params: ['$__interval'] },
          { id: LokiOperationId.Sum, params: [] },
        ],
      },
    ];
  }
}

export const lokiQueryModeller = new LokiQueryModeller();
