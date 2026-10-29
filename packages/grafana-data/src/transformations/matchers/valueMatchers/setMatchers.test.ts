import { toDataFrame } from '../../../dataframe/processDataFrame';
import { FieldType } from '../../../types/dataFrame';
import { getValueMatcher } from '../../matchers';

it.each([
  { includeMissing: undefined, expected: [null, undefined, '-'] },
  { includeMissing: false, expected: ['-'] },
  { includeMissing: true, expected: [null, undefined, '-'] },
])(
  'matches missing strings independently of display labels when includeMissing=$includeMissing',
  ({ includeMissing, expected }) => {
    const frame = toDataFrame({
      fields: [{ name: 'Text', type: FieldType.string, values: [null, undefined, '', '-', 'ok'] }],
    });
    const field = frame.fields[0];
    field.display = (value) => ({ text: value == null ? '-' : String(value), numeric: NaN });
    const matches = getValueMatcher({ id: 'inSet', options: { values: ['-'], mode: 'display', includeMissing } });
    expect(field.values.filter((_, index) => matches(index, field, frame, [frame]))).toEqual(expected);
  }
);

it('keeps an empty string separate from missing values', () => {
  const frame = toDataFrame({ fields: [{ name: 'Text', type: FieldType.string, values: [null, undefined, '', ' '] }] });
  const field = frame.fields[0];
  const matches = getValueMatcher({ id: 'inSet', options: { values: [''], includeMissing: false } });
  expect(field.values.filter((_, index) => matches(index, field, frame, [frame]))).toEqual(['']);
});
