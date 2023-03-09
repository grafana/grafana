import { ComparisonOperation } from '@grafana/schema';

import { Field, DataFrame } from '../../types/dataFrame';
import { FieldMatcherInfo } from '../../types/transformations';
import { reduceField, ReducerID } from '../fieldReducer';

import { compareValues } from './compareValues';
import { FieldMatcherID } from './ids';

export interface FieldValueMatcherConfig {
  reduce: ReducerID;
  op: ComparisonOperation;
  value?: number; // or string?
}

export const fieldValueMatcherInfo: FieldMatcherInfo<FieldValueMatcherConfig> = {
  id: FieldMatcherID.byValue,
  name: 'By value (reducer)',
  description: 'Rduce a field to a single value and test for inclusion',

  // This is added to overrides by default
  defaultOptions: {
    reduce: ReducerID.allIsZero,
    op: ComparisonOperation.GTE,
    value: 0,
  },

  get: (props) => {
    if (!props || !props.reduce) {
      return () => false;
    }
    const { reduce, op, value } = props;
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      const left = reduceField({
        field,
        reducers: [reduce],
      })[reduce];

      if (reduce === ReducerID.allIsNull || reduce === ReducerID.allIsZero) {
        return Boolean(left); // boolean
      }

      return compareValues(left, op, value);
    };
  },

  getOptionsDisplayText: () => {
    return `By values (reducer)`;
  },
};
