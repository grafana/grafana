import { LokiAndPromQueryModellerBase } from '../../prometheus/querybuilder/shared/LokiAndPromQueryModellerBase';
import { QueryBuilderLabelFilter } from '../../prometheus/querybuilder/shared/types';
import { getOperationDefintions } from './operations';
import { LokiVisualQuery, LokiVisualQueryOperationCategory } from './types';

export class LokiQueryModeller extends LokiAndPromQueryModellerBase<LokiVisualQuery> {
  constructor() {
    super(getOperationDefintions);

    this.setOperationCategories([
      LokiVisualQueryOperationCategory.Aggregations,
      LokiVisualQueryOperationCategory.RangeFunctions,
      LokiVisualQueryOperationCategory.Formats,
      //LokiVisualQueryOperationCategory.Functions,
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

  renderQuery(query: LokiVisualQuery) {
    let queryString = `${this.renderLabels(query.labels)}`;
    queryString = this.renderOperations(queryString, query.operations);
    queryString = this.renderBinaryQueries(queryString, query.binaryQueries);
    return queryString;
  }
}

export const lokiQueryModeller = new LokiQueryModeller();
