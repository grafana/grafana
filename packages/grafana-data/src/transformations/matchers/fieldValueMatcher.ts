import { ComparisonOperation } from '@grafana/schema';

import { Field, DataFrame } from '../../types/dataFrame';
import { FieldMatcherInfo } from '../../types/transformations';
import { reduceField, ReducerID } from '../fieldReducer';

import { compareValues } from './compareValues';
import { FieldMatcherID } from './ids';

export interface FieldValueMatcherConfig {
  reducer: ReducerID;
  op?: ComparisonOperation;
  value?: number; // or string?
}

// This should move to a utility function on the reducer registry
function isBooleanReducer(r: ReducerID) {
  return r === ReducerID.allIsNull || r === ReducerID.allIsZero;
}

export const fieldValueMatcherInfo: FieldMatcherInfo<FieldValueMatcherConfig> = {
  id: FieldMatcherID.byValue,
  name: 'By value (reducer)',
  description: 'Reduce a field to a single value and test for inclusion',

  // This is added to overrides by default
  defaultOptions: {
    reducer: ReducerID.allIsZero,
    op: ComparisonOperation.GTE,
    value: 0,
  },

  get: (props) => {
    if (!props || !props.reducer) {
      return () => false;
    }
    let { reducer, op, value } = props;
    const isBoolean = isBooleanReducer(reducer);
    if (!op) {
      op = ComparisonOperation.EQ;
    }
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      const left = reduceField({
        field,
        reducers: [reducer],
      })[reducer];

      if (isBoolean) {
        return Boolean(left); // boolean
      }
      return compareValues(left, op!, value);
    };
  },

  getOptionsDisplayText: (props) => {
    return `By value (${props.reducer})`;
  },
};
