import { FUNCTIONS } from '../promql';

import { getAggregationOperations } from './aggregations';
import { getOperationDefinitions } from './operations';
import { LokiAndPromQueryModellerBase } from './shared/LokiAndPromQueryModellerBase';
import { PromQueryPattern, PromVisualQueryOperationCategory } from './types';

export class PromQueryModeller extends LokiAndPromQueryModellerBase {
  constructor() {
    super(() => {
      const allOperations = [...getOperationDefinitions(), ...getAggregationOperations()];
      for (const op of allOperations) {
        const func = FUNCTIONS.find((x) => x.insertText === op.id);
        if (func) {
          op.documentation = func.documentation;
        }
      }
      return allOperations;
    });

    this.setOperationCategories([
      PromVisualQueryOperationCategory.Aggregations,
      PromVisualQueryOperationCategory.RangeFunctions,
      PromVisualQueryOperationCategory.Functions,
      PromVisualQueryOperationCategory.BinaryOps,
      PromVisualQueryOperationCategory.Trigonometric,
      PromVisualQueryOperationCategory.Time,
    ]);
  }

  getQueryPatterns(): PromQueryPattern[] {
    return [
      {
        name: 'Rate then sum',
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: 'sum', params: [] },
        ],
      },
      {
        name: 'Rate then sum by(label) then avg',
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: '__sum_by', params: [''] },
          { id: 'avg', params: [] },
        ],
      },
      {
        name: 'Histogram quantile on rate',
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: '__sum_by', params: ['le'] },
          { id: 'histogram_quantile', params: [0.95] },
        ],
      },
      {
        name: 'Histogram quantile on increase ',
        operations: [
          { id: 'increase', params: ['$__rate_interval'] },
          { id: '__max_by', params: ['le'] },
          { id: 'histogram_quantile', params: [0.95] },
        ],
      },
    ];
  }
}

export const promQueryModeller = new PromQueryModeller();
