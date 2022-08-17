import React from 'react';
import { QueryBuilderProps } from '../types';
import { QueryBuilderComponentSelector } from '../abstract';
import {
  Arithmetic,
  Constant,
  DoubleGreatest,
  DoubleLeast,
  FieldAccess,
  FinalizingFieldAccess,
  HyperUniqueCardinality,
  Javascript,
  LongGreatest,
  LongLeast,
  QuantilesDoublesSketchToQuantile,
} from './';

export const PostAggregation = (props: QueryBuilderProps) => (
  <QueryBuilderComponentSelector
    {...props}
    label="PostAggregation"
    components={{
      Arithmetic: Arithmetic,
      Constant: Constant,
      DoubleGreatest: DoubleGreatest,
      DoubleLeast: DoubleLeast,
      FieldAccess: FieldAccess,
      FinalizingFieldAccess: FinalizingFieldAccess,
      HyperUniqueCardinality: HyperUniqueCardinality,
      Javascript: Javascript,
      LongGreatest: LongGreatest,
      LongLeast: LongLeast,
      QuantilesDoublesSketchToQuantile: QuantilesDoublesSketchToQuantile,
    }}
  />
);
