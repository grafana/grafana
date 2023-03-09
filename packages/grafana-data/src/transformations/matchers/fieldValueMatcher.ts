import { ComparisonOperation } from '@grafana/schema';

import { Field, DataFrame } from '../../types/dataFrame';
import { FieldMatcherInfo } from '../../types/transformations';
import { reduceField, ReducerID } from '../fieldReducer';

import { compareValues } from './compareValues';
import { FieldMatcherID } from './ids';

export interface FieldValueMatcherConfig {
  reducer: ReducerID;
  op: ComparisonOperation;
  value?: number; // or string?
}

export const fieldValueMatcherInfo: FieldMatcherInfo<FieldValueMatcherConfig> = {
  id: FieldMatcherID.byValue,
  name: 'By value (reducer)',
  description: 'Rduce a field to a single value and test for inclusion',

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
    const { reducer, op, value } = props;
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      const left = reduceField({
        field,
        reducers: [reducer],
      })[reducer];

      if (reducer === ReducerID.allIsNull || reducer === ReducerID.allIsZero) {
        return Boolean(left); // boolean
      }

      return compareValues(left, op, value);
    };
  },

  getOptionsDisplayText: (props) => {
    return `By value (${props.reducer})`;
  },
};
