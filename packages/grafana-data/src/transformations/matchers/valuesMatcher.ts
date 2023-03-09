import { Field, DataFrame } from '../../types/dataFrame';
import { FieldMatcherInfo } from '../../types/transformations';
import { reduceField, ReducerID } from '../fieldReducer';

import { FieldMatcherID, ValueMatcherID } from './ids';

// import { FieldMatcherID, reduceField, ReducerID, ValueMatcherID, MatcherID } from '@grafana/data';

const valuesMatcher: FieldMatcherInfo = {
  id: FieldMatcherID.byValues,
  name: 'By values (reducer)',
  description: 'By values (reducer)',

  // todo: add condition (lower, greater) and RHS value
  get: (reducerId: ReducerID, cmp = '==', value = true) => {
    return (field: Field, frame: DataFrame, allFrames: DataFrame[]) => {
      let reds = reduceField({
        field,
        reducers: [reducerId],
      });

      if (reducerId === ReducerID.allIsNull || reducerId === ReducerID.allIsZero) {
        return reds[reducerId];
      }

      return false;
    };
  },

  getOptionsDisplayText: () => {
    return `By values (reducer)`;
  },
};

/**
 * Registry Initialization
 */
export function getValuesMatchers(): FieldMatcherInfo[] {
  return [valuesMatcher];
}
