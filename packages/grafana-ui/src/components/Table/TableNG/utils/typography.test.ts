import { FieldType, type DataLink, type Field } from '@grafana/data';

import { getCellLinks } from './dataLinks';
import {
  createTypographyContext,
  getDataLinksHeightMeasurer,
  getPillCellHeightMeasurer,
  getTextHeightEstimator,
  getTextHeightMeasurerFromUwrapCount,
} from './typography';

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
