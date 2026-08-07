import { Point } from 'ol/geom';

import { FieldType, type Field, type LinkModel } from '@grafana/data';

import { TableCellDisplayMode } from '../../types';
import { COLUMN, TABLE } from '../constants';
import { type GetActionsFunctionLocal } from '../types';

import { getCellLinks } from './display';
import { createTypographyContext } from './height';
import { buildNestedColumnWidthsMap, computeColWidths, computeContentAwareColWidths } from './width';

describe('computeColWidths', () => {
  it('returns the configured widths if all columns set them', () => {
    expect(
      computeColWidths(
        [
          { name: 'A', type: FieldType.string, values: [], config: { custom: { width: 100 } } },
          { name: 'B', type: FieldType.string, values: [], config: { custom: { width: 200 } } },
        ],
        500
      )
    ).toEqual([100, 200]);
  });

  it('fills the available space if a column has no width set', () => {
    expect(
      computeColWidths(
        [
          { name: 'A', type: FieldType.string, values: [], config: {} },
          { name: 'B', type: FieldType.string, values: [], config: { custom: { width: 200 } } },
        ],
        500
      )
    ).toEqual([300, 200]);
  });

  it('applies minimum width when auto width would dip below it', () => {
    expect(
      computeColWidths(
        [
          { name: 'A', type: FieldType.string, values: [], config: { custom: { minWidth: 100 } } },
          { name: 'B', type: FieldType.string, values: [], config: { custom: { minWidth: 100 } } },
        ],
        100
      )
    ).toEqual([100, 100]);
  });

  it('should use the global column default width when nothing is set', () => {
    expect(
      computeColWidths(
        [
          { name: 'A', type: FieldType.string, values: [], config: {} },
          { name: 'B', type: FieldType.string, values: [], config: {} },
        ],
        // we have two columns but have set the table to the width of one default column.
        COLUMN.DEFAULT_WIDTH
      )
    ).toEqual([COLUMN.DEFAULT_WIDTH, COLUMN.DEFAULT_WIDTH]);
  });
});

describe('computeContentAwareColWidths', () => {
  // Deterministic text measurement: every glyph is CHAR_W px wide, so a string of length L is
  // CHAR_W * L. Header widths are canvas-measured, so we mock measureText; body/pill content is
  // estimated from avgCharWidth, so we pin that to CHAR_W too (jsdom's real measureText returns
  // 0, which would otherwise make both meaningless). CELL_CHROME = 2 * CELL_PADDING + BORDER_RIGHT = 13.
  const CHAR_W = 8;
  const CELL_CHROME = 2 * TABLE.CELL_PADDING + TABLE.BORDER_RIGHT;

  const makeTypographyCtx = () => {
    const typographyCtx = createTypographyContext(14, 'sans-serif', 0.15);
    jest
      .spyOn(typographyCtx.ctx, 'measureText')
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .mockImplementation(((text: string) => ({
        width: String(text).length * CHAR_W,
      })) as typeof typographyCtx.ctx.measureText);
    typographyCtx.avgCharWidth = CHAR_W;
    return typographyCtx;
  };

  const compute = (fields: Field[], availWidth: number, showTypeIcons = false) =>
    computeContentAwareColWidths(fields, availWidth, { typographyCtx: makeTypographyCtx(), showTypeIcons });

  afterEach(() => jest.restoreAllMocks());

  it('sizes a numeric column to its content, well under the 150px even-split default (#634)', () => {
    // header "Value" (5) => 5*8+13 = 53; content "999" (3) => 3*8+13 = 37; so 53 wins.
    // availWidth == content total, so there is no leftover to grow into.
    const fields: Field[] = [{ name: 'Value', type: FieldType.number, values: [1, 42, 999], config: {} }];

    const [width] = compute(fields, 53);

    expect(width).toBe(53);
    expect(width).toBeLessThan(COLUMN.DEFAULT_WIDTH);
  });

  it('keeps a configured width verbatim and grows the auto column into the leftover space', () => {
    const fields: Field[] = [
      { name: 'A', type: FieldType.string, values: ['x'], config: { custom: { width: 100 } } },
      { name: 'B', type: FieldType.string, values: ['hi'], config: {} },
    ];
    // B content "hi" (2) => 29, header "B" (1) => 21 => floored to MIN_WIDTH 50.
    // leftover = 300 - 100 - 50 = 150, one auto column, so it absorbs all of it: 50 + 150 = 200.
    expect(compute(fields, 300)).toEqual([100, 200]);
  });

  it('grows text columns far more than numeric columns, but still lets numeric grow a little', () => {
    const fields: Field[] = [
      { name: 'N', type: FieldType.number, values: [999], config: {} }, // 37 => floor 50 (no text wiggle)
      { name: 'AAAA', type: FieldType.string, values: ['hello world'], config: {} }, // 11*8+13+6 = 107
      { name: 'B', type: FieldType.string, values: ['x'], config: {} }, // 27 => floor 50
    ];
    // content widths [50, 107, 50] total 207; availWidth 401 => leftover 194 split by growth share
    // growthWeight × √(content) (numeric 0.35, string 1): N 0.35√50=2.47, AAAA √107=10.34,
    // B √50=7.07 => total 19.89.
    //   N: 50 + 194*(2.47/19.89) = 74; AAAA: 107 + 194*(10.34/19.89) = 208; B: 50 + 194*(7.07/19.89) = 119.
    const result = compute(fields, 401);

    expect(result).toEqual([74, 208, 119]);
    // numeric grew, but much less than either text column; and the wider text column (AAAA) grew
    // more than the narrower one (B) since growth scales with √(content width).
    expect(result[0] - 50).toBeGreaterThan(0);
    expect(result[1] - 107).toBeGreaterThan(result[0] - 50);
    expect(result[1] - 107).toBeGreaterThan(result[2] - 50);
  });

  it('grows numeric and boolean columns only modestly while a string column takes most of the leftover', () => {
    const fields: Field[] = [
      { name: 'N', type: FieldType.number, values: [1], config: {} }, // floor 50
      { name: 'Bool', type: FieldType.boolean, values: [true], config: {} }, // floor 50
      { name: 'S', type: FieldType.string, values: ['x'], config: {} }, // floor 50
    ];
    // All three have content width 50, so √(content) is shared and only the weight differs
    // (N/Bool 0.35, S 1 => total 1.7): N/Bool 50 + 200*(0.35/1.7) = 91; S 50 + 200*(1/1.7) = 168.
    expect(compute(fields, 350)).toEqual([91, 91, 168]);
  });

  it('grows every auto column equally when they share a type (all-numeric table still fills the panel)', () => {
    const fields: Field[] = [
      { name: 'A', type: FieldType.number, values: [1], config: {} }, // floor 50
      { name: 'B', type: FieldType.number, values: [2], config: {} }, // floor 50
    ];
    // The shared weight cancels out, so both numeric columns split the leftover equally: 150 each.
    expect(compute(fields, 300)).toEqual([150, 150]);
  });

  it('honors a configured minWidth as the floor for an auto column', () => {
    const fields: Field[] = [
      { name: 'x', type: FieldType.string, values: ['a'], config: { custom: { minWidth: 120 } } },
    ];
    // content is tiny but minWidth floors it; availWidth == floor so no growth.
    expect(compute(fields, 120)).toEqual([120]);
  });

  it('caps a very long value at MAX_AUTO_WIDTH and keeps it (grid scrolls) when it overflows', () => {
    const longValue = 'x'.repeat(100); // 100*8+13 = 813, well over the 400 cap
    const fields: Field[] = [{ name: 's', type: FieldType.string, values: [longValue], config: {} }];
    // availWidth < cap, so leftover is negative: width stays at the cap and the grid scrolls.
    expect(compute(fields, 100)).toEqual([COLUMN.MAX_AUTO_WIDTH]);
  });

  it('measures the display-formatted string, not the raw value', () => {
    const fields: Field[] = [
      {
        name: 'S',
        type: FieldType.number,
        values: [1],
        config: {},
        // formats 1 -> "1 MiB" (length 5); the raw "1" would only be length 1.
        display: (v) => ({ text: `${v} MiB`, numeric: Number(v) }),
      },
    ];
    // "1 MiB" (5) => 5*8+13 = 53, which beats header "S" (1) => 21. availWidth < content so the
    // column can't grow to fill it (which would mask the difference): the raw "1" would size to
    // 50 (floored), so landing on 53 proves we measured the display string.
    expect(compute(fields, 40)).toEqual([53]);
  });

  it('measures a string field through its display processor, not the raw value', () => {
    const fields: Field[] = [
      {
        name: 'S',
        type: FieldType.string,
        values: ['fast'],
        config: {},
        // string fields can still carry units/value mappings; here "fast" renders as
        // "fast response time" (length 18) — AutoCell would show that, so we measure it.
        display: (v) => ({ text: `${v} response time`, numeric: NaN }),
      },
    ];
    // "fast response time" (18) => 18*8+13 + 6 text wiggle = 163, beating header "S" (1) => 21.
    // availWidth 100 is below the content width, so the column overflows and keeps 163 (grid
    // scrolls). The raw "fast" (4 => floored to 50) would instead grow to fill 100, so 163 proves
    // we used the display processor.
    expect(compute(fields, 100)).toEqual([163]);
  });

  it('uses a fixed default width for graphical (non-text) cells regardless of content', () => {
    const fields: Field[] = [
      {
        name: 'spark',
        type: FieldType.number,
        values: [999999999999],
        config: { custom: { cellOptions: { type: TableCellDisplayMode.Sparkline } } },
      },
    ];
    expect(compute(fields, COLUMN.DEFAULT_WIDTH)).toEqual([COLUMN.DEFAULT_WIDTH]);
  });

  it('uses a small fixed width for image columns rather than the graphical default', () => {
    const fields: Field[] = [
      {
        name: 'img',
        type: FieldType.string,
        values: ['http://example.com/a-very-long-image-url-that-should-not-widen-the-column.png'],
        config: { custom: { cellOptions: { type: TableCellDisplayMode.Image } } },
      },
    ];
    // Images take IMAGE_WIDTH regardless of the URL length; availWidth == it, so no growth.
    expect(compute(fields, COLUMN.IMAGE_WIDTH)).toEqual([COLUMN.IMAGE_WIDTH]);
  });

  it('sizes a markdown column to its header, not its (wrapping) source string', () => {
    const fields: Field[] = [
      {
        name: 'md',
        type: FieldType.string,
        values: ['# A long heading with [a link](http://example.com/really/long/url) and **bold** text'],
        config: { custom: { cellOptions: { type: TableCellDisplayMode.Markdown } } },
      },
    ];
    // Markdown always wraps and renders formatted, so it contributes no content width: header "md"
    // (2*8+13 = 29) floors to MIN_WIDTH 50. The long source would otherwise stretch it to the cap.
    expect(compute(fields, 50)).toEqual([50]);
  });

  it('sizes an actions column to fit its buttons via getActions (fuzzy width)', () => {
    const fields: Field[] = [
      {
        name: 'act',
        type: FieldType.other,
        values: [0],
        config: { custom: { cellOptions: { type: TableCellDisplayMode.Actions } } },
      },
    ];
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const getActions = (() => [{ title: 'Edit' }, { title: 'Delete' }]) as unknown as GetActionsFunctionLocal;
    // "Edit" (4*8+20=52) + gap 6 + "Delete" (6*8+20=68) => rowTotal 126; +CELL_CHROME 13 = 139.
    const widths = computeContentAwareColWidths(fields, 139, { typographyCtx: makeTypographyCtx(), getActions });
    expect(widths).toEqual([139]);
  });

  it('falls back to header/floor width for an actions column when getActions is not wired', () => {
    const fields: Field[] = [
      {
        name: 'act',
        type: FieldType.other,
        values: [0],
        config: { custom: { cellOptions: { type: TableCellDisplayMode.Actions } } },
      },
    ];
    // No getActions => measurer returns 0, so the column floors to MIN_WIDTH (header "act" is smaller).
    expect(computeContentAwareColWidths(fields, 50, { typographyCtx: makeTypographyCtx() })).toEqual([50]);
  });

  it('sizes a data links column to fit its links via getCellLinks (fuzzy width)', () => {
    const mockLinks: LinkModel[] = [
      { title: 'Open dashboard', href: 'http://x/1', target: '_blank', origin: { datasourceUid: 'test' } },
    ];
    const fields: Field[] = [
      {
        name: 'lnk',
        type: FieldType.string,
        values: ['x'],
        config: { custom: { cellOptions: { type: TableCellDisplayMode.DataLinks } } },
        getLinks: () => mockLinks,
      },
    ];
    // "Open dashboard" (14*8+8=120); one link => rowTotal 120; +CELL_CHROME 13 = 133.
    expect(computeContentAwareColWidths(fields, 133, { typographyCtx: makeTypographyCtx() })).toEqual([133]);
  });

  it('sizes a wrapped data links column to the widest single link, not the summed run', () => {
    const mockLinks: LinkModel[] = [
      { title: 'Open dashboard', href: 'http://x/1', target: '_blank', origin: { datasourceUid: 'test' } },
      { title: 'Docs', href: 'http://x/2', target: '_blank', origin: { datasourceUid: 'test' } },
    ];
    const field = (wrap: boolean): Field => ({
      name: 'lnk',
      type: FieldType.string,
      values: ['x'],
      config: {
        custom: { cellOptions: { type: TableCellDisplayMode.DataLinks }, ...(wrap ? { wrapText: true } : {}) },
      },
      getLinks: () => mockLinks,
    });
    // Wrapped links stack vertically, so the column follows the widest link ("Open dashboard",
    // 14*8+8=120; +CELL_CHROME 13 = 133) rather than the summed inline run of both links.
    const wrapped = computeContentAwareColWidths([field(true)], 50, { typographyCtx: makeTypographyCtx() });
    const inline = computeContentAwareColWidths([field(false)], 50, { typographyCtx: makeTypographyCtx() });
    expect(wrapped).toEqual([133]);
    expect(inline[0]).toBeGreaterThan(wrapped[0]);
  });

  it('sizes an auto column wide enough for its footer reducer value', () => {
    const withFooter: Field = {
      name: 'N',
      type: FieldType.number,
      values: [100000, 200000, 300000],
      config: { custom: { footer: { reducers: ['sum'] } } },
    };
    const noFooter: Field = { ...withFooter, config: {} };
    // The footer sum (600000) plus its reducer label is wider than the body values, so the column
    // with a footer is sized wider than the same column without one (which just hugs its cells).
    const [withW] = compute([withFooter], 60);
    const [withoutW] = compute([noFooter], 60);
    expect(withW).toBeGreaterThan(withoutW);
  });

  it('does not mutate the shared field state.calcs while measuring a footer', () => {
    const field: Field = {
      name: 'N',
      type: FieldType.number,
      values: [1, 2, 3],
      config: { custom: { footer: { reducers: ['sum'] } } },
    };
    compute([field], 200);
    // reduceField caches into field.state.calcs and the footer reuses it; the width calc must not
    // poison that cache with whole-dataset stats.
    expect(field.state?.calcs).toBeUndefined();
  });

  it('resolves an auto cell to its graphical default (geo) instead of measuring it as text', () => {
    // No explicit cellOptions, so the cell type is Auto; getAutoRendererDisplayMode maps a geo
    // field to Geo, which is graphical. availWidth < the default leaves no room to grow, so text
    // measurement (which would floor to MIN_WIDTH) is distinguishable from the graphical default.
    const fields: Field[] = [{ name: 'g', type: FieldType.geo, values: [new Point([0, -74.1])], config: {} }];

    expect(compute(fields, 40)).toEqual([COLUMN.DEFAULT_WIDTH]);
  });

  it('sizes a wrapped column to its content (capped) so content-heavy columns stay wider', () => {
    const fields: Field[] = [
      {
        name: 'S',
        type: FieldType.string,
        values: ['x'],
        config: { custom: { wrapText: true } },
      },
      {
        name: 'Desc',
        type: FieldType.string,
        values: ['a very long value that would wrap across multiple lines'], // 54 chars
        config: { custom: { wrapText: true } },
      },
    ];
    // Wrapped columns are still measured by content: the sparse "S" floors to MIN_WIDTH 50, while
    // the long "Desc" value (54*8+13 = 445) is capped at MAX_AUTO_WIDTH. availWidth == their sum,
    // so no growth — the content-heavy wrapped column is much wider than the sparse one.
    expect(compute(fields, 50 + COLUMN.MAX_AUTO_WIDTH)).toEqual([50, COLUMN.MAX_AUTO_WIDTH]);
  });

  it('reserves header icon space so the label is not truncated by the type icon', () => {
    const fields: Field[] = [{ name: 'Name', type: FieldType.string, values: ['a'], config: {} }];
    // header "Name" (4) => 4*8 = 32, + type-icon space 22 + chrome 13 = 67.
    expect(compute(fields, 67, /* showTypeIcons */ true)).toEqual([67]);
  });

  it('reserves header space for the sort arrow on a sorted column', () => {
    const fields: Field[] = [{ name: 'Name', type: FieldType.string, values: ['a'], config: {} }];
    // header "Name" (4) => 4*8 = 32, + sort-arrow space 22 + chrome 13 = 67; content "a" is tiny.
    const widths = computeContentAwareColWidths(fields, 67, {
      typographyCtx: makeTypographyCtx(),
      sortColumns: [{ columnKey: 'Name', direction: 'ASC' }],
    });
    expect(widths).toEqual([67]);
    // an unsorted column of the same content floors to MIN_WIDTH 50 (no arrow reserved).
    expect(compute(fields, 50)).toEqual([50]);
  });

  it('measures header labels with the medium-weight header context when provided', () => {
    // Header labels render bolder than the body, so a wider (medium-weight) context is passed for
    // them. This mock context measures every glyph 2px wider than the body's CHAR_W.
    const headerCtx = createTypographyContext(14, 'sans-serif', 0.15);
    jest
      .spyOn(headerCtx.ctx, 'measureText')
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .mockImplementation(((text: string) => ({ width: String(text).length * (CHAR_W + 2) })) as never);

    const fields: Field[] = [{ name: 'Value', type: FieldType.number, values: [9], config: {} }];
    // body content "9" floors to MIN_WIDTH 50; header "Value" (5) at the header font => 5*10+13 = 63
    // wins. Regular-weight measurement would give 5*8+13 = 53, so landing on 63 proves the header
    // context was used. availWidth == 63 leaves no room to grow.
    const widths = computeContentAwareColWidths(fields, 63, {
      typographyCtx: makeTypographyCtx(),
      headerTypographyCtx: headerCtx,
    });

    expect(widths).toEqual([63]);
  });

  it('samples a bounded number of rows (spread across the field) rather than scanning every value', () => {
    const display = jest.fn((v) => ({ text: String(v), numeric: Number(v) }));
    const fields: Field[] = [
      {
        name: 'big',
        type: FieldType.number,
        values: Array.from({ length: 100_000 }, (_, i) => i),
        config: {},
        display,
      },
    ];

    compute(fields, 1000);

    // one auto column => sample size clamps to the MAX_SAMPLE of 100, spread over the 100k rows.
    expect(display).toHaveBeenCalledTimes(100);
  });

  it('spreads the sample across the field so a sorted column is sized beyond its first rows', () => {
    // Ascending-style layout: many short values, then one long value in the last row. A
    // front-biased sample would miss the long tail; the evenly-spaced sample includes the last row.
    const values = [...new Array(50).fill('x'), 'X'.repeat(30)]; // 51 rows, long value at index 50
    const fields: Field[] = [{ name: 'c', type: FieldType.string, values, config: {} }];
    // sampleSize 5 => indices [0, 13, 25, 38, 50]; index 50 (30 chars) drives width:
    // 30*8+13 + 6 text wiggle = 259.
    const widths = computeContentAwareColWidths(fields, 259, { typographyCtx: makeTypographyCtx(), sampleSize: 5 });
    expect(widths).toEqual([259]);
  });

  describe('pill columns', () => {
    // Pill chip text is estimated from character count using the body ctx's avgCharWidth (no
    // separate pill-font measurement), which makeTypographyCtx pins to CHAR_W. Pill geometry:
    // 12px chip padding + 4px inter-pill gap (see the per-case comments below).
    const pillField = (name: string, values: unknown[]): Field => ({
      name,
      type: FieldType.other,
      values,
      config: { custom: { cellOptions: { type: TableCellDisplayMode.Pill } } },
    });

    const computeWithPills = (fields: Field[], availWidth: number) =>
      computeContentAwareColWidths(fields, availWidth, { typographyCtx: makeTypographyCtx() });

    it('sizes to fit an average row of pills across a couple of entries, not the longest value', () => {
      // one row: "AB" (2*8+12=28) + gap 4 + "CDE" (3*8+12=36) => rowTotal 68; +CELL_CHROME 13 = 81.
      const [width] = computeWithPills([pillField('a', [['AB', 'CDE']])], 81);
      expect(width).toBe(81);
    });

    it('never sizes below the widest single pill, so no chip is clipped', () => {
      // avg row total is small (short and long rows), but the widest pill floors the width so it
      // is not truncated: "A".repeat(20) => 20*8+12 = 172; +CELL_CHROME 13 = 185.
      const [width] = computeWithPills([pillField('a', [['X'], ['A'.repeat(20)]])], 185);
      expect(width).toBe(185);
      // (average row total would only be (20 + 172) / 2 = 96, well below what we return)
      expect(width).toBeGreaterThan(96 + CELL_CHROME);
    });

    it('caps a many-pill column at MAX_AUTO_WIDTH so it wraps to a few lines and scrolls', () => {
      const manyPills = Array.from({ length: 10 }, () => 'XXXXXXXX'); // 10 pills, 8 chars each
      const [width] = computeWithPills([pillField('a', [manyPills])], 100);
      expect(width).toBe(COLUMN.MAX_AUTO_WIDTH);
    });

    it('measures the display-formatted pill text, not the raw value', () => {
      const field = pillField('a', [['x']]);
      // PillCell renders field.display(pill); a value mapping turns the raw "x" (1 char) into
      // "mapped" (6 chars) => 6*8+12 = 60; +CELL_CHROME 13 = 73. The raw "x" would only be
      // 1*8+12=20 (+13=33), so landing on 73 proves we measured the formatted text.
      field.display = (v) => ({ text: v === 'x' ? 'mapped' : String(v), numeric: NaN });
      const [width] = computeWithPills([field], 73);
      expect(width).toBe(73);
    });

    it('grows a pill column with more entries wider than a sparser pill column', () => {
      const fields: Field[] = [
        // 3 pills (4*8+12=44 each) + 2 gaps of 4 => 140; +CELL_CHROME 13 = 153
        pillField('A', [['xxxx', 'yyyy', 'zzzz']]),
        // 1 pill (4*8+12=44) => 44; +CELL_CHROME 13 = 57
        pillField('D', [['wwww']]),
      ];
      // contentTotal 210; availWidth 410 => leftover 200. Growth share is √(content) (both weight
      // 1): √153=12.37 vs √57=7.55 => total 19.92. The busier column takes the larger share:
      //   A: 153 + 200*(12.37/19.92) = 277; D: 57 + 200*(7.55/19.92) = 133.
      expect(computeWithPills(fields, 410)).toEqual([277, 133]);
    });

    it('measures wrapped pill columns by content instead of collapsing them to the header', () => {
      const wrappedPill = (name: string, values: unknown[]): Field => ({
        ...pillField(name, values),
        config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.Pill } } },
      });
      // Wrapping is on, but pills are wrap-aware so they still size to their pill content — the
      // result matches the non-wrapped case above ([277, 133]). Before the fix, wrapText collapsed
      // both columns to their (equal, 21px) header width, so pill count made no difference.
      const fields = [wrappedPill('A', [['xxxx', 'yyyy', 'zzzz']]), wrappedPill('D', [['wwww']])];
      expect(computeWithPills(fields, 410)).toEqual([277, 133]);
    });
  });
});

describe('buildNestedColumnWidthsMap', () => {
  it('maps field display names to ColumnWidth entries', () => {
    const fields: Field[] = [
      { name: 'Time', type: FieldType.time, values: [], config: {}, state: { displayName: 'Time' } },
      { name: 'Value', type: FieldType.number, values: [], config: {}, state: { displayName: 'Value' } },
    ];
    const widths = [120, 200];

    const result = buildNestedColumnWidthsMap(fields, widths);

    expect(result.get('Time')).toEqual({ type: 'resized', width: 120 });
    expect(result.get('Value')).toEqual({ type: 'resized', width: 200 });
    expect(result.size).toBe(2);
  });

  it('uses the field display name (from state.displayName) as the map key', () => {
    const fields: Field[] = [
      {
        name: 'raw_name',
        type: FieldType.string,
        values: [],
        config: {},
        state: { displayName: 'Pretty Name' },
      },
    ];

    const result = buildNestedColumnWidthsMap(fields, [150]);

    expect(result.has('Pretty Name')).toBe(true);
    expect(result.has('raw_name')).toBe(false);
  });

  it('returns an empty map for empty inputs', () => {
    expect(buildNestedColumnWidthsMap([], []).size).toBe(0);
  });
});
