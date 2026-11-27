import { toDataFrame } from '../../../dataframe/processDataFrame';
import { FieldType } from '../../../types/dataFrame';
import { getValueMatcher } from '../../matchers';

import { getValueSetCandidates, splitFilterElements } from './setMatchers';

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

describe('matchElements', () => {
  it('matches array rows when any element is in the set (display mode)', () => {
    const frame = toDataFrame({
      fields: [{ name: 'Actors', type: FieldType.other, values: [['a', 'b'], ['c'], 'b', null] }],
    });
    const field = frame.fields[0];
    field.display = (value) => ({ text: String(value), numeric: NaN });
    const matches = getValueMatcher({ id: 'inSet', options: { values: ['b'], mode: 'display', matchElements: true } });
    expect(field.values.filter((_, index) => matches(index, field, frame, [frame]))).toEqual([['a', 'b'], 'b']);
  });

  it('matches array rows element-wise in raw mode', () => {
    const frame = toDataFrame({
      fields: [{ name: 'Nums', type: FieldType.other, values: [[1, 2], [3], 2] }],
    });
    const field = frame.fields[0];
    // Array elements are normalized to trimmed strings, mirroring rendered pills.
    const matches = getValueMatcher({ id: 'inSet', options: { values: ['2'], matchElements: true } });
    expect(field.values.filter((_, index) => matches(index, field, frame, [frame]))).toEqual([[1, 2]]);
  });

  it('matches per pill for pill-formatted strings', () => {
    const frame = toDataFrame({
      fields: [
        {
          name: 'Actors',
          type: FieldType.string,
          values: ['a, b', 'c', 'b'],
          config: { custom: { cellOptions: { type: 'pill' } } },
        },
      ],
    });
    const field = frame.fields[0];
    field.display = (value) => ({ text: String(value), numeric: NaN });
    const matches = getValueMatcher({ id: 'inSet', options: { values: ['b'], mode: 'display', matchElements: true } });
    expect(field.values.filter((_, index) => matches(index, field, frame, [frame]))).toEqual(['a, b', 'b']);
  });

  it('does not split plain strings, even with matchElements', () => {
    const frame = toDataFrame({ fields: [{ name: 'Name', type: FieldType.string, values: ['a, b', 'b'] }] });
    const field = frame.fields[0];
    field.display = (value) => ({ text: String(value), numeric: NaN });
    const matches = getValueMatcher({ id: 'inSet', options: { values: ['b'], mode: 'display', matchElements: true } });
    expect(field.values.filter((_, index) => matches(index, field, frame, [frame]))).toEqual(['b']);
  });

  it('keeps whole-value matching when matchElements is not set', () => {
    const frame = toDataFrame({
      fields: [{ name: 'Actors', type: FieldType.other, values: [['a', 'b'], ['c']] }],
    });
    const field = frame.fields[0];
    field.display = (value) => ({ text: String(value), numeric: NaN });
    const matches = getValueMatcher({ id: 'inSet', options: { values: ['b'], mode: 'display' } });
    expect(field.values.filter((_, index) => matches(index, field, frame, [frame]))).toEqual([]);
  });

  it('comma-splits bracketed strings with leading whitespace, like inferPills', () => {
    // inferPills checks the untrimmed first character for '[', so the cell
    // renders comma-split pills here; the filter must agree with the pills.
    expect(splitFilterElements(' ["a", "b"]')).toEqual(['["a"', '"b"]']);
  });

  it('parses JSON arrays without leading whitespace', () => {
    expect(splitFilterElements('["a", "b"]')).toEqual(['a', 'b']);
  });

  it('falls back to the whole value when a pill cell expands to nothing', () => {
    // '[]' parses to an empty element list, so the candidate fallback keeps
    // the whole value instead of dropping the row from every selection.
    expect(splitFilterElements('[]')).toEqual([]);
    const frame = toDataFrame({
      fields: [
        {
          name: 'Actors',
          type: FieldType.string,
          values: [],
          config: { custom: { cellOptions: { type: 'pill' } } },
        },
      ],
    });
    expect(getValueSetCandidates(frame.fields[0], '[]')).toEqual(['[]']);
  });

  it('still honors includeMissing for null array-field values', () => {
    const frame = toDataFrame({
      fields: [{ name: 'Actors', type: FieldType.other, values: [['a'], null] }],
    });
    const field = frame.fields[0];
    field.display = (value) => ({ text: String(value), numeric: NaN });
    const matches = getValueMatcher({
      id: 'inSet',
      options: { values: ['a'], mode: 'display', matchElements: true, includeMissing: true },
    });
    expect(field.values.filter((_, index) => matches(index, field, frame, [frame]))).toEqual([['a'], null]);
  });
});
