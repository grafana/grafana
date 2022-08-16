import React from 'react';
import { QueryBuilderProps } from '../types';
import { QueryBuilderComponentSelector } from '../abstract';

import {
  Cardinality,
  Count,
  DoubleAny,
  DoubleFirst,
  DoubleLast,
  DoubleMax,
  DoubleMean,
  DoubleMin,
  DoubleSum,
  Filtered,
  FloatAny,
  FloatFirst,
  FloatLast,
  FloatMax,
  FloatMin,
  FloatSum,
  Histogram,
  HyperUnique,
  Javascript,
  LongAny,
  LongFirst,
  LongLast,
  LongMax,
  LongMin,
  LongSum,
  QuantilesDoublesSketch,
  StringAny,
  StringFirstFolding,
  StringFirst,
  StringLastFolding,
  StringLast,
} from './';

export const Aggregation = (props: QueryBuilderProps) => (
  <QueryBuilderComponentSelector
    {...props}
    label="Aggregation"
    components={{
      Cardinality: Cardinality,
      Count: Count,
      DoubleAny: DoubleAny,
      DoubleFirst: DoubleFirst,
      DoubleLast: DoubleLast,
      DoubleMax: DoubleMax,
      DoubleMean: DoubleMean,
      DoubleMin: DoubleMin,
      DoubleSum: DoubleSum,
      Filtered: Filtered,
      FloatAny: FloatAny,
      FloatFirst: FloatFirst,
      FloatLast: FloatLast,
      FloatMax: FloatMax,
      FloatMin: FloatMin,
      FloatSum: FloatSum,
      Histogram: Histogram,
      HyperUnique: HyperUnique,
      Javascript: Javascript,
      LongAny: LongAny,
      LongFirst: LongFirst,
      LongLast: LongLast,
      LongMax: LongMax,
      LongMin: LongMin,
      LongSum: LongSum,
      QuantilesDoublesSketch: QuantilesDoublesSketch,
      StringAny: StringAny,
      StringFirstFolding: StringFirstFolding,
      StringFirst: StringFirst,
      StringLastFolding: StringLastFolding,
      StringLast: StringLast,
    }}
  />
);
