import { getLabelValueFromDataFrame } from './levels';

describe('getLabelValueFromDataFrame', () => {
  it('returns correct label value from data frame', () => {
    expect(getLabelValueFromDataFrame({ fields: [], length: 0 })).toEqual('100');
  });
});
