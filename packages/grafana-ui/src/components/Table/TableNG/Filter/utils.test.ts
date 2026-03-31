import { createDataFrame, FieldType, formattedValueToString } from '@grafana/data';

import { compileFrameToRecords } from '../utils';

import { calculateUniqueFieldValues, valuesToOptions } from './utils';

describe('calculateUniqueFieldValues', () => {
  it('returns empty object when field is undefined', () => {
    expect(calculateUniqueFieldValues([], undefined)).toEqual({});
  });

  it('returns empty object when rows are empty', () => {
    const frame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.string, values: [] }],
    });
    const field = frame.fields[0];
    expect(calculateUniqueFieldValues([], field)).toEqual({});
  });

  it('stores raw value as option value and display string as label for time fields', () => {
    const rawTimestamp = 1743379200000;
    const formattedDisplay = '2024-03-31 00:00:00';
    const frame = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [rawTimestamp],
          display: (_v) => ({ text: formattedDisplay, numeric: rawTimestamp }),
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame);
    const rows = frameToRecords(frame);
    const unique = calculateUniqueFieldValues(rows, frame.fields[0]);
    const options = valuesToOptions(unique);

    expect(options).toHaveLength(1);
    expect(options[0].label).toBe(formattedDisplay);
    expect(options[0].value).toEqual([String(rawTimestamp)]);
  });

  it('stores raw value as option value and display string as label for number fields with units', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'bytes',
          type: FieldType.number,
          values: [100, 200],
          display: (v) => ({ text: `${v} MB`, numeric: Number(v) }),
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame);
    const rows = frameToRecords(frame);
    const unique = calculateUniqueFieldValues(rows, frame.fields[0]);
    const options = valuesToOptions(unique);

    expect(options).toHaveLength(2);
    const opt100 = options.find((o) => o.label === '100 MB');
    expect(opt100?.value).toEqual(['100']);
  });

  it('skips rows with depth > 0', () => {
    const frame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.string, values: ['A', 'B', 'C'] }],
    });
    const frameToRecords = compileFrameToRecords(frame);
    const rows = frameToRecords(frame);
    // manually set depth on second row
    rows[1].__depth = 1;

    const unique = calculateUniqueFieldValues(rows, frame.fields[0]);
    const options = valuesToOptions(unique);

    expect(options.map((o) => o.label)).not.toContain('B');
    expect(options).toHaveLength(2);
  });

  it('deduplicates entries with the same display label', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'status',
          type: FieldType.string,
          values: ['up', 'up', 'down'],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame);
    const rows = frameToRecords(frame);
    const unique = calculateUniqueFieldValues(rows, frame.fields[0]);
    const options = valuesToOptions(unique);

    expect(options).toHaveLength(2);
  });

  it('collects all raw values sharing the same display label into one option', () => {
    // Two distinct timestamps that both display as "20 minutes ago"
    const ts1 = 1743379200000;
    const ts2 = 1743379201000;
    const frame = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [ts1, ts2],
          display: (_v) => ({ text: '20 minutes ago', numeric: NaN }),
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame);
    const rows = frameToRecords(frame);
    const unique = calculateUniqueFieldValues(rows, frame.fields[0]);
    const options = valuesToOptions(unique);

    // Only one option visible (same label)
    expect(options).toHaveLength(1);
    expect(options[0].label).toBe('20 minutes ago');
    // But both raw values are stored so filtering includes both rows
    expect(options[0].value).toEqual(expect.arrayContaining([String(ts1), String(ts2)]));
    expect((options[0].value as string[]).length).toBe(2);
  });

  it('uses (Blanks) label for empty display strings', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'value',
          type: FieldType.string,
          values: [''],
          display: (_v) => ({ text: '', numeric: NaN }),
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame);
    const rows = frameToRecords(frame);
    const unique = calculateUniqueFieldValues(rows, frame.fields[0]);
    const options = valuesToOptions(unique);

    expect(options).toHaveLength(1);
    expect(options[0].label).toBe('(Blanks)');
  });
});
