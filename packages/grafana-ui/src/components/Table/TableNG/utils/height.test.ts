import { createDataFrame, createTheme, FieldType, type DataLink, type Field, type LinkModel } from '@grafana/data';
import { TableCellHeight } from '@grafana/schema';

import { TableCellDisplayMode } from '../../types';
import { TABLE } from '../constants';
import { type MeasureCellHeightEntry, type TableRow } from '../types';

import { getCellLinks } from './display';
import { getDisplayName } from './fields';
import {
  buildCellHeightMeasurers,
  buildHeaderHeightMeasurers,
  calculateFooterHeight,
  createTypographyContext,
  getDataLinksHeightMeasurer,
  getDefaultRowHeight,
  getPillCellHeightMeasurer,
  getRowHeight,
  getTextHeightEstimator,
  getTextHeightMeasurerFromUwrapCount,
  SINGLE_LINE_ESTIMATE_THRESHOLD,
} from './height';
import { compileFrameToRecords } from './rows';

describe('createTypographyCtx', () => {
  // we can't test the effectiveness of this typography context in unit tests, only that it
  // actually executed the JS correctly. If you called `count` with a sensible value and width,
  // it wouldn't give you a very reasonable answer in Jest's DOM environment for some reason.
  it('creates the context using uwrap', () => {
    const field: Field = { name: 'test', type: FieldType.string, config: {}, values: ['foo', 'bar', 'baz'] };
    const ctx = createTypographyContext(14, 'sans-serif', 0.15);

    expect(ctx).toEqual(
      expect.objectContaining({
        ctx: expect.any(CanvasRenderingContext2D),
        fontFamily: 'sans-serif',
        letterSpacing: 0.15,
        measureHeight: expect.any(Function),
        estimateHeight: expect.any(Function),
        avgCharWidth: expect.any(Number),
      })
    );
    expect(ctx.measureHeight('the quick brown fox jumps over the lazy dog', 100, field, 0, 20)).toEqual(
      expect.any(Number)
    );
    expect(ctx.estimateHeight('the quick brown fox jumps over the lazy dog', 100, field, 0, 20)).toEqual(
      expect.any(Number)
    );
  });
});

describe('getTextHeightMeasurerFromUwrapCount', () => {
  const field: Field = { name: 'test', type: FieldType.string, config: {}, values: ['foo', 'bar', 'baz'] };

  it('wraps the uwrap count function', () => {
    const measureHeight = getTextHeightMeasurerFromUwrapCount(jest.fn(() => 2));
    expect(measureHeight('test string', 100, field, 0, 20)).toBe(40);
  });

  it("returns a single line's height for null or undefined values", () => {
    const measureHeight = getTextHeightMeasurerFromUwrapCount(jest.fn(() => 2));
    expect(measureHeight(null, 100, field, 0, 20)).toBe(20);
    expect(measureHeight(undefined, 100, field, 0, 20)).toBe(20);
  });
});

describe('getTextHeightEstimator', () => {
  const estimator = getTextHeightEstimator(10);
  const field: Field = { name: 'test', type: FieldType.string, config: {}, values: ['foo', 'bar', 'baz'] };

  it('returns -1 if there are no strings or dashes within the string', () => {
    expect(estimator('asdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdf', 5, field, 0, 22)).toBe(-1);
  });

  it('calculates an approximate rendered height for the text based on the width and avgCharWidth', () => {
    expect(estimator('asdfas dfasdfasdf asdfasdfasdfa sdfasdfasdfasdf 23', 200, field, 0, 20)).toBe(60);
  });
});

describe('getDataLinksHeightMeasurer', () => {
  it('counts number of valid links using getCellLinks', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {
        links: [
          { title: 'Link 1', url: 'http://example.com/1' },
          { title: 'Invalid Link' } as DataLink, // No href or onClick
          {
            title: 'Link w',
            url: 'asdf',
            onClick: jest.fn(() => {}),
          },
        ],
      },
      values: ['value1'],
    };

    const measurer = getDataLinksHeightMeasurer();
    expect(measurer('my value', 100, field, 0, 20)).toBe(40);
  });
});

describe('getPillCellHeightMeasurer', () => {
  it('counts up the number of lines using the pill measuring method', () => {
    const measurer = getPillCellHeightMeasurer(jest.fn((str) => str.length * 5));
    expect(measurer('tag1,tag2', 100, {} as Field, 0, 20)).toBe(20);
    expect(measurer('tag1,tag2,tag3,tag4,tag5,tag6', 100, {} as Field, 0, 20)).toBe(68);
  });

  it('returns 0 if value is null', () => {
    const measurer = getPillCellHeightMeasurer(jest.fn((str) => str.length * 5));
    expect(measurer(null, 100, {} as Field, 0, 20)).toBe(0);
  });

  it('returns 0 if no pills are inferred', () => {
    const measurer = getPillCellHeightMeasurer(jest.fn((str) => str.length * 5));
    expect(measurer('', 100, {} as Field, 0, 20)).toBe(0);
  });

  it('caches the width measurement for the same value', () => {
    const widthMeasurement = jest.fn((str) => str.length * 5);
    const measurer = getPillCellHeightMeasurer(widthMeasurement);
    measurer('tag1,tag2,tag3,tag4,tag5,tag6', 100, {} as Field, 0, 20);
    measurer('tag1,tag2', 100, {} as Field, 0, 20);
    measurer('tag2', 200, {} as Field, 0, 20);
    measurer('tag2,tag3,tag2,tag4,tag4,tag2,tag5', 300, {} as Field, 0, 20);
    expect(widthMeasurement).toHaveBeenCalledTimes(6); // Should only call for unique values
  });

  it('does not re-measure pill text when only the column width changes (resize)', () => {
    const widthMeasurement = jest.fn((str) => str.length * 5);
    const measurer = getPillCellHeightMeasurer(widthMeasurement);
    const value = 'aaaa,bbbb,cccc';
    measurer(value, 100, {} as Field, 0, 20);
    expect(widthMeasurement).toHaveBeenCalledTimes(3); // one per unique pill
    // resizing re-runs only the wrap arithmetic; pill text is not measured again
    measurer(value, 60, {} as Field, 0, 20);
    measurer(value, 300, {} as Field, 0, 20);
    expect(widthMeasurement).toHaveBeenCalledTimes(3);
  });

  it('returns a consistent height when the same value and width are measured repeatedly', () => {
    const measurer = getPillCellHeightMeasurer(jest.fn((str) => str.length * 5));
    const first = measurer('tag1,tag2,tag3,tag4,tag5,tag6', 100, {} as Field, 0, 20);
    // react-data-grid re-measures every row on each layout pass; repeats must be stable
    expect(measurer('tag1,tag2,tag3,tag4,tag5,tag6', 100, {} as Field, 0, 20)).toBe(first);
  });

  it('wraps to more lines as the column narrows', () => {
    const measurer = getPillCellHeightMeasurer(jest.fn((str) => str.length * 5));
    const wide = measurer('tag1,tag2,tag3,tag4,tag5,tag6', 400, {} as Field, 0, 20);
    const narrow = measurer('tag1,tag2,tag3,tag4,tag5,tag6', 100, {} as Field, 0, 20);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('scales the height with the caller line height at the same width', () => {
    const measurer = getPillCellHeightMeasurer(jest.fn((str) => str.length * 5));
    const value = 'tag1,tag2,tag3,tag4,tag5,tag6';
    // this value wraps to 3 lines at width 100: 3*20 + 2*4 = 68.
    expect(measurer(value, 100, {} as Field, 0, 20)).toBe(68);
    // a different line height applies to the same 3 lines: 3*30 + 2*4 = 98.
    expect(measurer(value, 100, {} as Field, 0, 30)).toBe(98);
  });
});

describe('getDefaultRowHeight', () => {
  const theme = createTheme();

  it.each([
    { input: TableCellHeight.Sm, expected: 36 },
    { input: TableCellHeight.Md, expected: 42 },
    { input: TableCellHeight.Lg, expected: TABLE.MAX_CELL_HEIGHT },
  ])('returns "$expected" for "$input"', ({ input, expected }) => {
    const result = getDefaultRowHeight(theme, [], input);
    expect(result).toBe(expected);
  });

  it('returns "min-content" if a field is present with the dynamicHeight=true cellOption', () => {
    expect(
      getDefaultRowHeight(
        theme,
        [
          {
            name: 'test1',
            type: FieldType.string,
            config: {},
            values: ['value1'],
          },
          {
            name: 'test2',
            type: FieldType.string,
            config: { custom: { cellOptions: { type: TableCellDisplayMode.Markdown, dynamicHeight: true } } },
            values: ['value1'],
          },
          {
            name: 'test3',
            type: FieldType.number,
            config: { custom: { cellOptions: { type: TableCellDisplayMode.JSONView } } },
            values: [3],
          },
        ],
        TableCellHeight.Sm
      )
    ).toBe('min-content');
  });

  it('calculates height based on theme when cellHeight is undefined', () => {
    const result = getDefaultRowHeight(theme, []);

    // default theme: CELL_PADDING*2 (12) + fontSize 14 * body.lineHeight ≈ 34
    expect(result).toBe(34);
  });
});

describe('buildHeaderHeightMeasurers', () => {
  const ctx = {
    fontFamily: 'sans-serif',
    letterSpacing: 0.15,
    ctx: {} as CanvasRenderingContext2D,
    count: jest.fn(() => 2),
    avgCharWidth: 7,
    measureHeight: jest.fn(() => 2),
    estimateHeight: jest.fn(() => 2),
  };

  it('returns an array of measurers for each column', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: { wrapHeaderText: true } } },
      { name: 'Age', type: FieldType.number, values: [], config: { custom: { wrapHeaderText: true } } },
    ];
    const measurers = buildHeaderHeightMeasurers(fields, ctx);
    expect(measurers![0].measure).toEqual(expect.any(Function));
    expect(measurers![0].fieldIdxs).toEqual([0, 1]);
  });

  it('does not return the index of columns which are not wrapped', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
      { name: 'Age', type: FieldType.number, values: [], config: { custom: { wrapHeaderText: true } } },
    ];

    const measurers = buildHeaderHeightMeasurers(fields, ctx);
    expect(measurers![0].fieldIdxs).toEqual([1]);
  });

  it('returns undefined if no columns are wrapped', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
      { name: 'Age', type: FieldType.number, values: [], config: { custom: {} } },
    ];

    const measurers = buildHeaderHeightMeasurers(fields, ctx);
    expect(measurers).toBeUndefined();
  });
});

describe('buildCellHeightMeasurers', () => {
  const ctx = {
    fontFamily: 'sans-serif',
    letterSpacing: 0.15,
    ctx: {} as CanvasRenderingContext2D,
    measureHeight: jest.fn(() => 2),
    estimateHeight: jest.fn(() => 2),
    avgCharWidth: 7,
  };

  it('sets up text height measurers for each text column if wrapping is on', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: { wrapText: true } } },
      {
        name: 'Address',
        type: FieldType.string,
        values: [],
        config: { custom: { wrapText: true } },
      },
    ];
    const measurers = buildCellHeightMeasurers(fields, ctx);
    expect(measurers![0].measure).toEqual(expect.any(Function));
    expect(measurers![0].fieldIdxs).toEqual([0, 1]);
  });

  it('does not return the index of columns which are not wrapped', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
      {
        name: 'Address',
        type: FieldType.string,
        values: [],
        config: { custom: { wrapText: true } },
      },
    ];

    const measurers = buildCellHeightMeasurers(fields, ctx);
    expect(measurers![0].fieldIdxs).toEqual([1]);
  });

  it('sets up line counting for pills if present and wrapping is on', () => {
    const fields: Field[] = [
      {
        name: 'Tags',
        type: FieldType.string,
        values: ['tag1,tag2', 'tag3', '["tag4","tag5","tag6"]'],
        config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.Pill } } },
      },
    ];
    const measurers = buildCellHeightMeasurers(fields, ctx);
    // pills are measured precisely (the cheap estimate was removed because it mis-ranked columns)
    expect(measurers![0].measure).toEqual(expect.any(Function));
    expect(measurers![0].measure('tag1,tag2', 100, fields[0], 0, 22)).toEqual(expect.any(Number));
    expect(measurers![0].fieldIdxs).toEqual([0]);
  });

  it('sets up line counting for datalinks if present and wrapping is on', () => {
    const fields: Field[] = [
      {
        name: 'Links',
        type: FieldType.string,
        values: ['http://example.com/1', 'http://example.com/2'],
        config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.DataLinks } } },
        getLinks: jest.fn((): LinkModel[] => [
          { title: 'Link 1', href: 'http://example.com/1', target: '_blank', origin: { datasourceUid: 'test' } },
          { title: 'Link 2', href: 'http://example.com/2', target: '_self', origin: { datasourceUid: 'test' } },
        ]),
      },
    ];
    const measurers = buildCellHeightMeasurers(fields, ctx);
    expect(measurers![0].measure).toEqual(expect.any(Function));
    expect(measurers![0].measure('http://example.com/1', 100, fields[0], 0, 22)).toEqual(expect.any(Number));
    expect(measurers![0].fieldIdxs).toEqual([0]);
  });

  it('enables text counting for Time fields rendered by AutoCellRenderer', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
      {
        name: 'Time',
        type: FieldType.time,
        values: [],
        config: { custom: { wrapText: true } },
        display: (v) => ({ text: '2024-03-26 14:30:00', numeric: v as number, color: undefined, title: undefined }),
      },
    ];

    const measurers = buildCellHeightMeasurers(fields, ctx);
    // Time fields use AutoCellRenderer (same as string fields) and can produce long formatted strings
    expect(measurers).toBeDefined();
    expect(measurers![0].fieldIdxs).toEqual([1]);
  });

  it('enables text counting for Number fields rendered by AutoCellRenderer', () => {
    const fields: Field[] = [
      {
        name: 'Value',
        type: FieldType.number,
        values: [],
        config: { custom: { wrapText: true } },
        display: (v) => ({ text: String(v), numeric: v as number, color: undefined, title: undefined }),
      },
    ];

    const measurers = buildCellHeightMeasurers(fields, ctx);
    expect(measurers).toBeDefined();
    expect(measurers![0].fieldIdxs).toEqual([0]);
  });

  it('does not enable text counting for non-AutoCellRenderer fields like Gauge', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
      {
        name: 'Score',
        type: FieldType.number,
        values: [],
        config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.Gauge } } },
      },
    ];

    const measurers = buildCellHeightMeasurers(fields, ctx);
    // Gauge cells don't use AutoCellRenderer, so no measurer is set up
    expect(measurers).toBeUndefined();
  });

  it('returns an undefined if no columns are wrapped', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
      { name: 'Age', type: FieldType.number, values: [], config: { custom: {} } },
    ];

    const measurers = buildCellHeightMeasurers(fields, ctx);
    expect(measurers).toBeUndefined();
  });

  it('clamps by maxHeight if set', () => {
    const fields: Field[] = [
      {
        name: 'Tags',
        type: FieldType.string,
        values: ['tag1,tag2', 'tag3', '["tag4","tag5","tag6"]'],
        config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.Pill } } },
      },
    ];
    const measurers = buildCellHeightMeasurers(fields, ctx);
    expect(measurers![0].measure!(fields[0].values[2], 20, fields[0], 2, 100)).toBeGreaterThan(50);

    fields[0].config!.custom!.maxHeight = 50;
    const measurersWithMax = buildCellHeightMeasurers(fields, ctx, 50);
    expect(measurersWithMax![0].measure!(fields[0].values[2], 20, fields[0], 2, 100)).toBe(50);
  });
});

describe('getRowHeight', () => {
  let fields: Field[];
  let rows: TableRow[];
  let measurers: MeasureCellHeightEntry[];

  beforeEach(() => {
    fields = [
      {
        name: 'Name',
        type: FieldType.string,
        values: ['foo', 'bar', 'baz', 'longer one here', 'shorter'],
        config: { custom: { wrapText: true } },
      },
      {
        name: 'Age',
        type: FieldType.number,
        values: [1, 2, 3, 123456, 789122349932],
        config: { custom: { wrapText: true } },
      },
    ];
    const frame = createDataFrame({ fields });
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    rows = frameToRecords(frame);
    measurers = [
      {
        measure: jest.fn((value, _length, _field, _rowIdx, lineHeight) => String(value).split(' ').length * lineHeight),
        fieldIdxs: [0],
      }, // Mocked to count words as lines
      {
        measure: jest.fn(
          (value, _length, _field, _rowIdx, lineHeight) => Math.ceil(String(value).length / 3) * lineHeight
        ),
        fieldIdxs: [1],
      }, // Mocked to return a line for every 3 digits of a number
    ];
  });

  it('should use the default height for single-line rows', () => {
    // 1 line @ 20px, 10px vertical padding = 30, minimum is 36
    expect(getRowHeight(fields, { __index: 0, __depth: 0 }, [30, 30], 36, measurers, 20, 10)).toBe(36);
  });

  it('should use the default height for multi-line rows which are shorter than the default height', () => {
    // 3 lines @ 5px, 5px vertical padding = 20, minimum is 36
    expect(getRowHeight(fields, { __index: 3, __depth: 0 }, [30, 30], 36, measurers, 5, 5)).toBe(36);
  });

  it('should return the row height using line measurers for multi-line', () => {
    // 3 lines @ 20px ('longer', 'one', 'here'), 10px vertical padding
    expect(getRowHeight(fields, rows[3], [30, 30], 36, measurers, 20, 10)).toBe(70);

    // 4 lines @ 15px (789 122 349 932), 15px vertical padding
    expect(getRowHeight(fields, rows[4], [30, 30], 36, measurers, 15, 15)).toBe(75);
  });

  it('should take colWidths into account when calculating max wrap cell', () => {
    getRowHeight(fields, rows[3], [50, 60], 36, measurers, 20, 10);
    expect(measurers[0].measure).toHaveBeenCalledWith('longer one here', 50, fields[0], 3, 20);
    expect(measurers[1].measure).toHaveBeenCalledWith(123456, 60, fields[1], 3, 20);
  });

  // this is used to calc wrapped header height
  it('should use the display name if the rowIdx is -1', () => {
    getRowHeight(fields, { __index: -1, __depth: 0 }, [50, 60], 36, measurers, 20, 10);
    expect(measurers[0].measure).toHaveBeenCalledWith('Name', 50, fields[0], -1, 20);
    expect(measurers[1].measure).toHaveBeenCalledWith('Age', 60, fields[1], -1, 20);
  });

  it('should ignore columns which do not have measurers', () => {
    const height = getRowHeight(fields, rows[3], [30, 30], 36, [measurers[1]], 20, 10);
    // 2 lines @ 20px, 10px vertical padding (not 3 lines, since we don't line count Name)
    expect(height).toBe(50);
  });

  it('should return the default height if there are no measurers to apply', () => {
    const height = getRowHeight(fields, rows[3], [30, 30], 36, [], 20, 10);
    expect(height).toBe(36);
  });

  describe('estimations vs. precise counts', () => {
    beforeEach(() => {
      measurers = [
        {
          measure: jest.fn(
            (value, _length, _field, _rowIdx, lineHeight) => String(value).split(' ').length * lineHeight
          ),
          fieldIdxs: [0],
        }, // Mocked to count words as lines
        {
          measure: jest.fn(
            (value, _length, _field, _rowIdx, lineHeight) => Math.ceil(String(value).length / 3) * lineHeight
          ),
          estimate: jest.fn((value, _length, _field, _rowIdx, lineHeight) => String(value).length * lineHeight), // Mocked to return a line for every digits of a number
          fieldIdxs: [1],
        }, // Mocked to return a line for every 3 digits of a number
      ];
    });

    // the `estimate` function picks `123456` as the tallest (6 lines), then the `measure` function is
    // used to calculate its true height (2 lines). measurers[0] is forced to a single short line so it
    // doesn't set the row-height floor — this test is only about the estimate-then-remeasure selection.
    // 2 lines @ 20px (123,456) + 10px vertical padding = 50.
    it('uses the estimate value rather than the precise value to select the row height', () => {
      jest.mocked(measurers[0].measure).mockReturnValue(20);
      expect(getRowHeight(fields, rows[3], [30, 30], 36, measurers, 20, 10)).toBe(50);
    });

    it('returns doesnt bother getting the precise count if the estimates are all below the threshold', () => {
      jest.mocked(measurers[0].measure).mockReturnValue(SINGLE_LINE_ESTIMATE_THRESHOLD - 0.3);
      jest.mocked(measurers[1].estimate!).mockReturnValue(SINGLE_LINE_ESTIMATE_THRESHOLD - 0.1);

      expect(getRowHeight(fields, rows[3], [30, 30], 36, measurers, 20, 10)).toBe(36);

      // this is what we really care about - we want to save on performance by not calling the measure in this case.
      expect(measurers[1].measure).not.toHaveBeenCalled();
    });

    it('uses the precise count if the estimate is above the threshold, even if its below 1', () => {
      // NOTE: if this fails, just change the test to use a different value besides 1
      const thresholdOffset = 1;
      expect(SINGLE_LINE_ESTIMATE_THRESHOLD + thresholdOffset).toBeLessThan(TABLE.LINE_HEIGHT);

      jest.mocked(measurers[0].measure).mockReturnValue(SINGLE_LINE_ESTIMATE_THRESHOLD - thresholdOffset);
      jest.mocked(measurers[1].estimate!).mockReturnValue(SINGLE_LINE_ESTIMATE_THRESHOLD + thresholdOffset);

      expect(getRowHeight(fields, rows[3], [30, 30], 36, measurers, 20, 10)).toBe(50);
    });

    // measurers[0] has no estimate, so it runs precisely in the first pass (like a pill column).
    // measurers[1] over-estimates and wins the pass, but its precise remeasure comes back shorter
    // than measurers[0]'s precise height. The row must stay tall enough for measurers[0] rather
    // than adopting the shrunken winner height and clipping that column.
    it('does not discard a precise measurer height when the estimated winner remeasures shorter', () => {
      jest.mocked(measurers[0].measure).mockReturnValue(60); // precise height of the non-estimating column
      jest.mocked(measurers[1].estimate!).mockReturnValue(100); // over-estimate wins the first pass
      jest.mocked(measurers[1].measure).mockReturnValue(30); // true height of the winner is short

      // max(remeasured winner 30, precise 60) = 60, + 10px vertical padding = 70
      expect(getRowHeight(fields, rows[3], [30, 30], 36, measurers, 20, 10)).toBe(70);
    });
  });

  describe('non-string fields with display processor', () => {
    it('measures the display-formatted string for Time fields, not the raw epoch number', () => {
      const FORMATTED_TIME = '2024-03-26 14:30:00';
      const EPOCH_MS = 1711462200000;

      const timeFields: Field[] = [
        {
          name: 'Time',
          type: FieldType.time,
          values: [EPOCH_MS],
          config: { custom: { wrapText: true } },
          display: jest.fn(() => ({ text: FORMATTED_TIME, numeric: EPOCH_MS, color: undefined, title: undefined })),
        },
      ];
      const frame = createDataFrame({ fields: timeFields });
      const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
      const timeRows = frameToRecords(frame);

      const timeMeasurer = {
        measure: jest.fn((_value, _width, _field, _rowIdx, lineHeight) => lineHeight),
        fieldIdxs: [0],
      };

      getRowHeight(timeFields, timeRows[0], [100], 36, [timeMeasurer], 20, 10);

      // Must be called with the formatted string, not the raw epoch number
      expect(timeMeasurer.measure).toHaveBeenCalledWith(FORMATTED_TIME, 100, timeFields[0], 0, 20);
      expect(timeMeasurer.measure).not.toHaveBeenCalledWith(EPOCH_MS, 100, timeFields[0], 0, 20);
    });

    it('still passes the raw value for string fields (no display transformation)', () => {
      const stringFields: Field[] = [
        {
          name: 'Name',
          type: FieldType.string,
          values: ['hello world'],
          config: { custom: { wrapText: true } },
          display: jest.fn(() => ({ text: 'SHOULD NOT BE USED', numeric: NaN, color: undefined, title: undefined })),
        },
      ];
      const frame = createDataFrame({ fields: stringFields });
      const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
      const stringRows = frameToRecords(frame);

      const stringMeasurer = {
        measure: jest.fn((_value, _width, _field, _rowIdx, lineHeight) => lineHeight),
        fieldIdxs: [0],
      };

      getRowHeight(stringFields, stringRows[0], [100], 36, [stringMeasurer], 20, 10);

      // String fields pass through the raw value, not the display-formatted value
      expect(stringMeasurer.measure).toHaveBeenCalledWith('hello world', 100, stringFields[0], 0, 20);
    });

    it('uses the display name for header rows (rowIdx === -1) regardless of field type', () => {
      const EPOCH_MS = 1711462200000;

      const timeFields: Field[] = [
        {
          name: 'Time',
          type: FieldType.time,
          values: [EPOCH_MS],
          config: { custom: { wrapText: true } },
          display: jest.fn(() => ({
            text: '2024-03-26 14:30:00',
            numeric: EPOCH_MS,
            color: undefined,
            title: undefined,
          })),
        },
      ];

      const timeMeasurer = {
        measure: jest.fn((_value, _width, _field, _rowIdx, lineHeight) => lineHeight),
        fieldIdxs: [0],
      };

      // rowIdx -1 = header row; value should be the field display name
      getRowHeight(timeFields, { __index: -1, __depth: 0 }, [100], 36, [timeMeasurer], 20, 10);

      expect(timeMeasurer.measure).toHaveBeenCalledWith('Time', 100, timeFields[0], -1, 20);
      // display() should not have been called for header rows
      expect(timeFields[0].display).not.toHaveBeenCalled();
    });
  });
});

describe('calculateFooterHeight', () => {
  it('should return 0 if no footer is present', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 1, 2], nanos: [100, 99, 0] },
        { name: 'value', values: [10, 20, 30] },
      ],
    });

    expect(calculateFooterHeight(frame.fields)).toBe(0);
  });

  it('should return the height in pixels for the max reducers on a given field', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'time',
          values: [1, 1, 2],
          nanos: [100, 99, 0],
          config: { custom: { footer: { reducers: ['min', 'max', 'count'] } } },
        },
        { name: 'value', values: [10, 20, 30], config: { custom: { footer: { reducers: ['min'] } } } },
      ],
    });

    expect(calculateFooterHeight(frame.fields)).toBe(78); // 3 reducers * 22px line height + 12px padding
  });
});
