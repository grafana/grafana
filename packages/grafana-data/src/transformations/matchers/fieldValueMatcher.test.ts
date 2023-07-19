import { ComparisonOperation } from '@grafana/schema';

import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldMatcher } from '../../types';
import { DataFrame, FieldType } from '../../types/dataFrame';
import { ReducerID } from '../fieldReducer';

import { fieldValueMatcherInfo } from './fieldValueMatcher';

function getMatchingFieldNames(matcher: FieldMatcher, frame: DataFrame): string[] {
  return frame.fields.filter((f) => matcher(f, frame, [])).map((f) => f.name);
}

describe('Field Value Matcher', () => {
  const testFrame = toDataFrame({
    fields: [
      { name: '01', type: FieldType.number, values: [0, 1] },
      { name: '02', type: FieldType.number, values: [0, 2] },
      { name: '03', type: FieldType.number, values: [0, 3] },
      { name: 'null', type: FieldType.number, values: [null, null] },
    ],
  });

  it('match nulls', () => {
    expect(
      getMatchingFieldNames(
        fieldValueMatcherInfo.get({
          reducer: ReducerID.allIsNull,
        }),
        testFrame
      )
    ).toEqual(['null']);
  });

  it('match equals', () => {
    expect(
      getMatchingFieldNames(
        fieldValueMatcherInfo.get({
          reducer: ReducerID.lastNotNull,
          op: ComparisonOperation.EQ,
          value: 1,
        }),
        testFrame
      )
    ).toEqual(['01']);
  });

  it('match equals', () => {
    expect(
      getMatchingFieldNames(
        fieldValueMatcherInfo.get({
          reducer: ReducerID.lastNotNull,
          op: ComparisonOperation.GTE,
          value: 2,
        }),
        testFrame
      )
    ).toEqual(['02', '03']);
  });
});
