import { ComparisonOperation } from '@grafana/schema';

import { Field, DataFrame } from '../../types/dataFrame';
import { FieldMatcherInfo } from '../../types/transformations';
import { reduceField, ReducerID } from '../fieldReducer';

import { FieldMatcherID } from './ids';

export interface FieldValuesMatcherConfig {
  reduce: ReducerID;
  op: ComparisonOperation;
  value?: number; // or string?
}

export const fieldValueMatcherInfo: FieldMatcherInfo<FieldValuesMatcherConfig> = {
  id: FieldMatcherID.byValues,
  name: 'By values (reducer)',
  description: 'By values (reducer)',

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

/**
 * Compare two values
 *
 * @alpha
 */
export function compareValues(
  left: string | number | boolean | null | undefined,
  op: ComparisonOperation,
  right: string | number | boolean | null | undefined
) {
  // Normalize null|undefined values
  if (left == null || right == null) {
    if (left == null) {
      left = 'null';
    }
    if (right == null) {
      right = 'null';
    }
    if (op === ComparisonOperation.GTE || op === ComparisonOperation.LTE) {
      op = ComparisonOperation.EQ; // check for equality
    }
  }

  switch (op) {
    case ComparisonOperation.EQ:
      return `${left}` === `${right}`;
    case ComparisonOperation.NEQ:
      return `${left}` !== `${right}`;
    case ComparisonOperation.GT:
      return left > right;
    case ComparisonOperation.GTE:
      return left >= right;
    case ComparisonOperation.LT:
      return left < right;
    case ComparisonOperation.LTE:
      return left <= right;
    default:
      return false;
  }
}
