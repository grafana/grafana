// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/PromQueryModeller.ts
import { getFunctions } from '../promql';

import { getAggregationOperations } from './aggregations';
import { getOperationDefinitions } from './operations';
import { PromQueryModellerBase } from './shared/PromQueryModellerBase';
import {
  PromQueryPattern,
  PromQueryPatternType,
  PromVisualQueryOperationCategory,
  PromQueryModellerInterface,
} from './types';

export class PromQueryModeller extends PromQueryModellerBase implements PromQueryModellerInterface {
  constructor() {
    super(() => {
      const allOperations = [...getOperationDefinitions(), ...getAggregationOperations()];
      for (const op of allOperations) {
        const func = getFunctions().find((x) => x.insertText === op.id);
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
        type: PromQueryPatternType.Rate,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: 'sum', params: [] },
        ],
      },
      {
        name: 'Rate then sum by(label) then avg',
        type: PromQueryPatternType.Rate,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: '__sum_by', params: [''] },
          { id: 'avg', params: [] },
        ],
      },
      {
        name: 'Histogram quantile on rate',
        type: PromQueryPatternType.Histogram,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: '__sum_by', params: ['le'] },
          { id: 'histogram_quantile', params: [0.95] },
        ],
      },
      {
        name: 'Histogram quantile on increase',
        type: PromQueryPatternType.Histogram,
        operations: [
          { id: 'increase', params: ['$__rate_interval'] },
          { id: '__max_by', params: ['le'] },
          { id: 'histogram_quantile', params: [0.95] },
        ],
      },
      {
        name: 'Binary Query',
        type: PromQueryPatternType.Binary,
        operations: [
          { id: 'rate', params: ['$__rate_interval'] },
          { id: 'sum', params: [] },
        ],
        binaryQueries: [
          {
            operator: '/',
            query: {
              metric: '',
              labels: [],
              operations: [
                { id: 'rate', params: ['$__rate_interval'] },
                { id: 'sum', params: [] },
              ],
            },
          },
        ],
      },
    ];
  }
}
