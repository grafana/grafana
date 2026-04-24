import { type Field, FieldType } from '@grafana/data';

import { type TableRow } from '../types';

import { calculateUniqueFieldValues, getFilteredOptions, operatorSelectableValues, valuesToOptions } from './utils';

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
    expect(keys).toContain('Contains');
    expect(keys).toContain('=');
    expect(keys).toContain('!=');
    expect(keys).toContain('>');
    expect(keys).toContain('>=');
    expect(keys).toContain('<');
    expect(keys).toContain('<=');
    expect(keys).toContain('Expression');
  });

  it('each operator entry has a value matching its key', () => {
    const ops = operatorSelectableValues();
    for (const [key, op] of Object.entries(ops)) {
      expect(op.value).toBe(key);
    }
  });
});
