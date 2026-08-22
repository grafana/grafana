import { toDataFrame } from '../../../dataframe/processDataFrame';
import { type DataFrame, FieldType } from '../../../types/dataFrame';
import { getValueMatcher } from '../../matchers';
import { ValueMatcherID } from '../ids';

function framesOf(values: unknown[]): DataFrame[] {
  return [toDataFrame({ fields: [{ name: 'temp', type: FieldType.number, values }] })];
}

/** Runs the matcher over every row of the fixture, so one assertion pins the whole boundary. */
function matchEvery(frames: DataFrame[], id: ValueMatcherID): boolean[] {
  const matcher = getValueMatcher({ id, options: { value: 11 } });
  const [frame] = frames;
  const field = frame.fields[0];

  return field.values.map((_, index) => matcher(index, field, frame, frames));
}

describe('numeric value matchers', () => {
  describe('comparison against the option value', () => {
    const frames = framesOf([23, 11, 10]);

    it.each([
      { id: ValueMatcherID.greater, expected: [true, false, false] },
      { id: ValueMatcherID.greaterOrEqual, expected: [true, true, false] },
      { id: ValueMatcherID.lower, expected: [false, false, true] },
      { id: ValueMatcherID.lowerOrEqual, expected: [false, true, true] },
    ])('$id matches [23, 11, 10] against 11 as $expected', ({ id, expected }) => {
      expect(matchEvery(frames, id)).toEqual(expected);
    });
  });

  describe('non-numeric values', () => {
    const frames = framesOf([undefined, NaN, 'abc']);

    it.each([ValueMatcherID.greater, ValueMatcherID.greaterOrEqual, ValueMatcherID.lower, ValueMatcherID.lowerOrEqual])(
      '%s does not match undefined, NaN or an unparseable string',
      (id) => {
        expect(matchEvery(frames, id)).toEqual([false, false, false]);
      }
    );
  });

  describe('null values', () => {
    // null is the one non-numeric value these matchers do not reject: it converts to 0 rather
    // than NaN, so a gap in a number field is compared as a zero and matches "is lower than"
    // any positive option value.
    const frames = framesOf([null]);

    it.each([
      { id: ValueMatcherID.greater, expected: false },
      { id: ValueMatcherID.greaterOrEqual, expected: false },
      { id: ValueMatcherID.lower, expected: true },
      { id: ValueMatcherID.lowerOrEqual, expected: true },
    ])('$id returns $expected for null against 11, comparing it as 0', ({ id, expected }) => {
      expect(matchEvery(frames, id)).toEqual([expected]);
    });
  });
});
