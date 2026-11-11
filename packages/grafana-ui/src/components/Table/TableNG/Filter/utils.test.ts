import { type Field, FieldType } from '@grafana/data';
import { getValueSetCandidates } from '@grafana/data/internal';

import { type TableRow } from '../types';

jest.mock('@grafana/data/internal', () => {
  const actual = jest.requireActual('@grafana/data/internal');
  return {
    ...actual,
    getValueSetCandidates: jest.fn(actual.getValueSetCandidates),
  };
});

import {
  calculateUniqueFieldValues,
  getFieldFilterValues,
  getFilteredOptions,
  isLegacyWholeCellSelection,
  operatorSelectableValues,
  rangeHistogram,
  remapSelectionsToCurrentDisplay,
  restoreWholeCellSelections,
  rowMatchesFilterValues,
  sliderBoundText,
  sliderDecimals,
  valuesToOptions,
} from './utils';

it('bins the full finite distribution without counting missing values as zero', () => {
  expect(rangeHistogram([null, Infinity, NaN, -1, -1, 0, 29]).bins).toEqual([2, 1, ...Array(27).fill(0), 1]);
  expect(rangeHistogram([null, Infinity, NaN]).missing).toBe(3);
  expect(rangeHistogram([7, 7]).bins).toEqual([2]);
});

it('uses raw field precision independently of display formatting', () => {
  const values = [16.95899372, 18.39482761];

  expect(sliderDecimals(values, values[1] - values[0])).toBe(8);
  expect(sliderBoundText(17.456789, values[0], '', 1)).toBe('17.5');
});

it('ignores display decimals and retains enough precision for narrow ranges', () => {
  expect(sliderDecimals([0.125, 1.125], 1)).toBe(3);
  expect(sliderDecimals([371.499999999999, 372.499999999999], 1)).toBe(3);
  expect(sliderDecimals([0, 0.00001], 0.00001)).toBe(8);
});

it('keeps typed precision on an untouched bound while rounding a moved slider bound', () => {
  expect(sliderBoundText(0.123456789, 0.123456789, '0.123456789', 3)).toBe('0.123456789');
  expect(sliderBoundText(0.998999999999, 1, '', 3)).toBe('0.999');
});

function makeField(name: string, displayName?: string): Field {
  return {
    name,
    type: FieldType.string,
    values: [],
    config: {},
    state: displayName ? { displayName } : undefined,
  };
}

function makeRow(columnName: string, value: unknown, depth = 0): TableRow {
  return { __depth: depth, __index: 0, [columnName]: value as string };
}

describe('calculateUniqueFieldValues', () => {
  it('returns empty object when field is undefined', () => {
    expect(calculateUniqueFieldValues([makeRow('Status', 'active')], undefined)).toEqual({});
  });

  it('returns empty object when rows is empty', () => {
    expect(calculateUniqueFieldValues([], makeField('Status'))).toEqual({});
  });

  it('skips nested rows (depth > 0)', () => {
    const field = makeField('Status');
    const rows = [makeRow('Status', 'top-level', 0), makeRow('Status', 'nested', 1)];
    const result = calculateUniqueFieldValues(rows, field);
    expect(Object.keys(result)).toEqual(['top-level']);
  });

  it('uses field.display to format values when provided', () => {
    const field: Field = {
      ...makeField('Temp'),
      display: (v: unknown) => ({ text: `${v}°C`, numeric: Number(v), color: '' }),
    };
    const rows = [makeRow('Temp', 22), makeRow('Temp', 37)];
    const result = calculateUniqueFieldValues(rows, field);
    expect(Object.keys(result).sort()).toEqual(['22°C', '37°C']);
  });

  it('falls back to String() when display is not provided', () => {
    const field = makeField('Count');
    const rows = [makeRow('Count', 42)];
    const result = calculateUniqueFieldValues(rows, field);
    expect(result).toEqual({ '42': '42' });
  });

  it('uses "(Blanks)" key when display produces an empty string', () => {
    const field: Field = {
      ...makeField('Status'),
      display: () => ({ text: '', numeric: 0, color: '' }),
    };
    const rows = [makeRow('Status', null)];
    const result = calculateUniqueFieldValues(rows, field);
    expect(result).toHaveProperty('(Blanks)');
    expect(result['(Blanks)']).toBe('');
  });

  it('deduplicates rows that produce the same display value', () => {
    const field = makeField('Status');
    const rows = [makeRow('Status', 'active'), makeRow('Status', 'active'), makeRow('Status', 'inactive')];
    const result = calculateUniqueFieldValues(rows, field);
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('reads row values using the field display name when set', () => {
    const field = makeField('status_code', 'Status');
    const rows = [{ __depth: 0, __index: 0, Status: 'ok' } as TableRow];
    const result = calculateUniqueFieldValues(rows, field);
    expect(result).toEqual({ ok: 'ok' });
  });

  it('expands array values into one option per element', () => {
    const field: Field = { ...makeField('Actors'), type: FieldType.other };
    const rows = [makeRow('Actors', ['a', 'b']), makeRow('Actors', ['b', 'c'])];
    const result = calculateUniqueFieldValues(rows, field);
    expect(result).toEqual({ a: 'a', b: 'b', c: 'c' });
  });

  it('formats each array element with field.display', () => {
    const field: Field = {
      ...makeField('Temp'),
      type: FieldType.other,
      display: (v: unknown) => ({ text: `${v}°C`, numeric: Number(v), color: '' }),
    };
    const rows = [makeRow('Temp', [22, 37])];
    const result = calculateUniqueFieldValues(rows, field);
    expect(result).toEqual({ '22°C': '22°C', '37°C': '37°C' });
  });

  it('splits pill-cell strings into one option per pill', () => {
    const field: Field = {
      ...makeField('Actors'),
      config: { custom: { cellOptions: { type: 'pill' } } },
    };
    const rows = [makeRow('Actors', 'a, b'), makeRow('Actors', 'c')];
    const result = calculateUniqueFieldValues(rows, field);
    expect(result).toEqual({ a: 'a', b: 'b', c: 'c' });
  });

  it('keeps comma-separated strings whole for non-pill fields', () => {
    const field = makeField('Name');
    const rows = [makeRow('Name', 'a, b')];
    const result = calculateUniqueFieldValues(rows, field);
    expect(result).toEqual({ 'a, b': 'a, b' });
  });

  it('falls back to the whole value for empty arrays', () => {
    const field: Field = {
      ...makeField('Actors'),
      type: FieldType.other,
      display: () => ({ text: '', numeric: 0, color: '' }),
    };
    const rows = [makeRow('Actors', [])];
    const result = calculateUniqueFieldValues(rows, field);
    expect(result).toHaveProperty('(Blanks)');
  });
});

describe('getFieldFilterValues', () => {
  it('returns the single whole-value string for scalars', () => {
    const field = makeField('Status');
    expect(getFieldFilterValues(makeRow('Status', 'active'), field)).toEqual(['active']);
  });

  it('returns one string per element for arrays', () => {
    const field: Field = { ...makeField('Actors'), type: FieldType.other };
    expect(getFieldFilterValues(makeRow('Actors', ['a', 'b']), field)).toEqual(['a', 'b']);
  });
});

describe('rowMatchesFilterValues', () => {
  it('matches when any element is selected', () => {
    const field: Field = { ...makeField('Actors'), type: FieldType.other };
    const row = makeRow('Actors', ['a', 'b']);
    // arrays expand without needing the pill flag
    expect(rowMatchesFilterValues(row, field, new Set(['b']), false)).toBe(true);
    expect(rowMatchesFilterValues(row, field, new Set(['c']), false)).toBe(false);
  });

  it('matches whole values for scalar fields', () => {
    const field = makeField('Status');
    expect(rowMatchesFilterValues(makeRow('Status', 'active'), field, new Set(['active']), false)).toBe(true);
    expect(rowMatchesFilterValues(makeRow('Status', 'active'), field, new Set(['inactive']), false)).toBe(false);
  });

  it('stops formatting after the first matching element', () => {
    const display = jest.fn((value: unknown) => ({ text: String(value), numeric: 0 }));
    const field: Field = { ...makeField('Actors'), type: FieldType.other, display };
    const row = makeRow(
      'Actors',
      Array.from({ length: 100 }, (_, i) => `pill${i}`)
    );
    expect(rowMatchesFilterValues(row, field, new Set(['pill0']), false)).toBe(true);
    expect(display).toHaveBeenCalledTimes(1);
  });

  it('formats every element when the match is last', () => {
    const display = jest.fn((value: unknown) => ({ text: String(value), numeric: 0 }));
    const field: Field = { ...makeField('Actors'), type: FieldType.other, display };
    const row = makeRow(
      'Actors',
      Array.from({ length: 100 }, (_, i) => `pill${i}`)
    );
    expect(rowMatchesFilterValues(row, field, new Set(['pill99']), false)).toBe(true);
    expect(display).toHaveBeenCalledTimes(100);
  });

  it('formats every element and returns false when nothing matches', () => {
    const display = jest.fn((value: unknown) => ({ text: String(value), numeric: 0 }));
    const field: Field = { ...makeField('Actors'), type: FieldType.other, display };
    const row = makeRow(
      'Actors',
      Array.from({ length: 100 }, (_, i) => `pill${i}`)
    );
    expect(rowMatchesFilterValues(row, field, new Set(['zzz']), false)).toBe(false);
    expect(display).toHaveBeenCalledTimes(100);
  });

  it('expands pill strings element-wise when the pill flag is set', () => {
    const field: Field = {
      ...makeField('Actors'),
      config: { custom: { cellOptions: { type: 'pill' } } },
    };
    const row = makeRow('Actors', 'a, b');
    expect(rowMatchesFilterValues(row, field, new Set(['b']), true)).toBe(true);
    expect(rowMatchesFilterValues(row, field, new Set(['z']), true)).toBe(false);
    // without the flag the same string compares as one whole value
    expect(rowMatchesFilterValues(row, field, new Set(['b']), false)).toBe(false);
    expect(rowMatchesFilterValues(row, field, new Set(['a, b']), false)).toBe(true);
  });
});

describe('scalar fast paths', () => {
  beforeEach(() => {
    jest.mocked(getValueSetCandidates).mockClear();
  });

  it('calculateUniqueFieldValues never expands scalar cells', () => {
    const field = makeField('Status');
    expect(calculateUniqueFieldValues([makeRow('Status', 'active')], field)).toEqual({ active: 'active' });
    expect(getValueSetCandidates).not.toHaveBeenCalled();
  });

  it('rowMatchesFilterValues never expands scalar cells', () => {
    const field = makeField('Status');
    expect(rowMatchesFilterValues(makeRow('Status', 'active'), field, new Set(['active']), false)).toBe(true);
    expect(getValueSetCandidates).not.toHaveBeenCalled();
  });

  it('control: array cells do expand, proving the mock observes the import', () => {
    const field: Field = { ...makeField('Actors'), type: FieldType.other };
    calculateUniqueFieldValues([makeRow('Actors', ['a'])], field);
    expect(getValueSetCandidates).toHaveBeenCalled();
  });
});

describe('getFilteredOptions', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Gamma' },
  ];

  it('returns empty array when filterValues is undefined', () => {
    expect(getFilteredOptions(options, undefined)).toEqual([]);
  });

  it('returns empty array when filterValues is empty', () => {
    expect(getFilteredOptions(options, [])).toEqual([]);
  });

  it('returns options whose value matches a filterValue', () => {
    const result = getFilteredOptions(options, [{ value: 'a' }, { value: 'c' }]);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.value)).toEqual(['a', 'c']);
  });

  it('returns the option object from the options array, not from filterValues', () => {
    const result = getFilteredOptions(options, [{ value: 'b', label: 'stale label' }]);
    expect(result[0].label).toBe('Beta');
  });

  it('returns empty when no options match', () => {
    expect(getFilteredOptions(options, [{ value: 'z' }])).toEqual([]);
  });
});

describe('valuesToOptions', () => {
  it('converts a record into selectable values with key as label and record value as value', () => {
    const result = valuesToOptions({ Apple: 'apple', Banana: 'banana' });
    expect(result).toEqual(
      expect.arrayContaining([
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' },
      ])
    );
  });

  it('sorts options alphabetically by label', () => {
    const result = valuesToOptions({ Zebra: 'z', Apple: 'a', Mango: 'm' });
    expect(result.map((o) => o.label)).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('returns an empty array for an empty record', () => {
    expect(valuesToOptions({})).toEqual([]);
  });
});

describe('operatorSelectableValues', () => {
  it('returns an entry for each FilterOperator', () => {
    const ops = operatorSelectableValues();
    const keys = Object.keys(ops);
    expect(keys.sort()).toMatchSnapshot();
  });

  it('each operator entry has a value matching its key', () => {
    const ops = operatorSelectableValues();
    for (const [key, op] of Object.entries(ops)) {
      expect(op.value).toBe(key);
    }
  });
});

function makePillField(name: string): Field {
  return {
    ...makeField(name),
    config: { custom: { cellOptions: { type: 'pill' } } },
  };
}

describe('isLegacyWholeCellSelection', () => {
  it('detects unflagged selections on pill fields', () => {
    expect(isLegacyWholeCellSelection(makePillField('Actors'), { values: ['a, b'] })).toBe(true);
  });

  it('detects unflagged selections on array-valued fields', () => {
    const field: Field = { ...makeField('Actors'), type: FieldType.other, values: [['a']] };
    expect(isLegacyWholeCellSelection(field, { values: ['a'] })).toBe(true);
  });

  it('ignores flagged per-element selections', () => {
    const field: Field = { ...makeField('Actors'), type: FieldType.other, values: [['a']] };
    expect(isLegacyWholeCellSelection(field, { values: ['a'], matchElements: true })).toBe(false);
  });

  it('ignores scalar fields, whose values were always whole-cell', () => {
    expect(isLegacyWholeCellSelection(makeField('Status'), { values: ['active'] })).toBe(false);
  });
});

describe('restoreWholeCellSelections', () => {
  it('expands a saved array cell onto its per-element options', () => {
    const field: Field = { ...makeField('Actors'), type: FieldType.other };
    const rows = [makeRow('Actors', ['a', 'b']), makeRow('Actors', ['c'])];
    // Without field.display the stored whole-cell string is String(cell).
    expect(restoreWholeCellSelections(rows, field, ['a,b'])).toEqual(['a', 'b']);
  });

  it('expands a saved pill cell onto its per-pill options', () => {
    const field = makePillField('Actors');
    const rows = [makeRow('Actors', 'a, b'), makeRow('Actors', 'c')];
    expect(restoreWholeCellSelections(rows, field, ['a, b'])).toEqual(['a', 'b']);
  });

  it('formats restored elements with field.display', () => {
    const field: Field = {
      ...makeField('Temp'),
      type: FieldType.other,
      display: (v: unknown) => ({ text: `${v}!`, numeric: Number(v) }),
    };
    const rows = [makeRow('Temp', [22, 37])];
    expect(restoreWholeCellSelections(rows, field, ['22,37!'])).toEqual(['22!', '37!']);
  });

  it('drops stored values matching no row', () => {
    const field: Field = { ...makeField('Actors'), type: FieldType.other };
    const rows = [makeRow('Actors', ['a'])];
    expect(restoreWholeCellSelections(rows, field, ['zzz'])).toEqual([]);
  });

  it('passes scalar whole values through unchanged', () => {
    const field = makeField('Status');
    const rows = [makeRow('Status', 'active')];
    expect(restoreWholeCellSelections(rows, field, ['active'])).toEqual(['active']);
  });
});

describe('remapSelectionsToCurrentDisplay', () => {
  const previousDisplay = (v: unknown) => ({ text: `old:${String(v)}`, numeric: NaN });
  const currentDisplay = (v: unknown) => ({ text: `new:${String(v)}`, numeric: NaN });

  it('expands legacy whole-cell values to current per-element strings', () => {
    const field: Field = { ...makeField('Actors'), type: FieldType.other };
    const rows = [makeRow('Actors', ['a', 'b']), makeRow('Actors', ['c'])];
    expect(
      remapSelectionsToCurrentDisplay({
        rows,
        field,
        storedValues: ['old:a,b'],
        previousDisplay,
        currentDisplay,
        legacyWholeCell: true,
      })
    ).toEqual(['new:a', 'new:b']);
  });

  it('remaps per-element values candidate by candidate', () => {
    const field: Field = { ...makeField('Actors'), type: FieldType.other };
    const rows = [makeRow('Actors', ['a', 'b'])];
    expect(
      remapSelectionsToCurrentDisplay({
        rows,
        field,
        storedValues: ['old:b'],
        previousDisplay,
        currentDisplay,
        legacyWholeCell: false,
      })
    ).toEqual(['new:b']);
  });

  it('skips null rows when includeMissing is set', () => {
    const field = makeField('Status');
    const rows = [makeRow('Status', null)];
    expect(
      remapSelectionsToCurrentDisplay({
        rows,
        field,
        storedValues: ['old:null'],
        previousDisplay,
        currentDisplay,
        includeMissing: true,
        legacyWholeCell: false,
      })
    ).toEqual([]);
  });
});
