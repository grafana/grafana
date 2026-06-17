import {
  createDataFrame,
  createTheme,
  FieldType,
  getDisplayProcessor,
  MappingType,
  SpecialValueMatch,
  ThresholdsMode,
  type Field,
} from '@grafana/data';
import { AxisPlacement, FieldColorModeId, VisibilityMode } from '@grafana/schema';

import { PointShape } from './panelcfg.gen';
import { paletteHasAlpha, prepConfig } from './scatter';
import { type XYSeries } from './types2';

/*
 * Why mock UPlotConfigBuilder:
 * - Real one needs a uPlot instance + canvas context (no DOM in Jest)
 * - Stubbing its methods lets prepConfig run through setup without crashing
 * - We only care about the returned prepData closure, not the builder itself
 */
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  UPlotConfigBuilder: jest.fn().mockImplementation(() => ({
    addScale: jest.fn(),
    addAxis: jest.fn(),
    addSeries: jest.fn(),
    setCursor: jest.fn(),
    addHook: jest.fn(),
    setMode: jest.fn(),
  })),
}));

const theme = createTheme();

function makeField(opts: {
  name: string;
  values: number[];
  type?: FieldType;
  config?: Record<string, unknown>;
}): Field {
  const { name, values, type = FieldType.number, config = {} } = opts;

  const { custom, ...rest } = config;

  const field = createDataFrame({
    fields: [
      {
        name,
        type,
        values,
        config: {
          custom: {
            pointSize: { fixed: 5, min: 1, max: 10 },
            axisLabel: '',
            axisPlacement: AxisPlacement.Auto,
            ...(custom as Record<string, unknown>),
          },
          ...rest,
        },
      },
    ],
  }).fields[0];

  field.display = getDisplayProcessor({ field, theme });

  return field;
}

function makeSeries(overrides?: Partial<XYSeries>): XYSeries {
  return {
    showPoints: VisibilityMode.Always,
    pointShape: PointShape.Circle,
    pointStrokeWidth: 1,
    fillOpacity: 50,
    showLine: false,
    lineWidth: 1,
    lineStyle: { fill: 'solid' },
    name: { value: 'Series A' },
    x: { field: makeField({ name: 'x', values: [1, 2, 3] }) },
    y: { field: makeField({ name: 'y', values: [10, 20, 30], config: { unit: 'y' } }) },
    color: { fixed: '#ff0000' },
    size: { fixed: 5 },
    _rest: [],
    ...overrides,
  };
}

describe('prepConfig', () => {
  it('returns null builder and warn when xySeries is empty', () => {
    const result = prepConfig([], theme);
    expect(result.builder).toBeNull();
    expect(result.warn).toEqual('No data');
  });

  it('returns non-null builder and null warn when series provided', () => {
    const result = prepConfig([makeSeries()], theme);
    expect(result.builder).not.toBeNull();
    expect(result.warn).toBeNull();
  });
});

describe('prepData', () => {
  it('returns data array with null first element (uPlot convention)', () => {
    const series = makeSeries();
    const { prepData } = prepConfig([series], theme);
    const data = prepData!([series]);
    expect(data[0]).toBeNull();
  });

  it('each series entry has [xValues, yValues, diameters, colors] shape', () => {
    const series = makeSeries();
    const { prepData } = prepConfig([series], theme);
    const data = prepData!([series]);
    const entry = data[1] as unknown[][];
    expect(entry).toHaveLength(4);
    expect(entry[0]).toEqual([1, 2, 3]);
    expect(entry[1]).toEqual([10, 20, 30]);
  });

  it('fills all diameters with the fixed value when no size field is mapped', () => {
    const series = makeSeries({ size: { fixed: 7 } });
    const { prepData } = prepConfig([series], theme);
    const data = prepData!([series]);
    const entry = data[1] as unknown[][];
    expect(entry[2]).toEqual([7, 7, 7]);
  });

  it('fills all color entries with the fixed value when no color field is mapped', () => {
    const series = makeSeries({ color: { fixed: '#00ff00' } });
    const { prepData } = prepConfig([series], theme);
    const data = prepData!([series]);
    const entry = data[1] as unknown[][];
    expect(entry[3]).toEqual(['#00ff00', '#00ff00', '#00ff00']);
  });

  it('scales diameters by area (not linearly) when a size field is mapped', () => {
    const sizeField = makeField({ name: 'sz', values: [0, 50, 100] });
    const series = makeSeries({
      size: { field: sizeField, min: 2, max: 10, fixed: 5 },
    });
    const { prepData } = prepConfig([series], theme);
    const data = prepData!([series]);
    const diams = data[1]![2] as number[];

    // diam = √(minPx² + valPct * (maxPx² - minPx²))
    expect(diams[0]).toBeCloseTo(2, 5);
    expect(diams[1]).toBeCloseTo(Math.sqrt(52), 5);
    expect(diams[2]).toBeCloseTo(10, 5);
  });

  it('normalizes diameters against the global min/max when multiple series share a size field', () => {
    const series1 = makeSeries({
      x: { field: makeField({ name: 'x', values: [1, 2] }) },
      y: { field: makeField({ name: 'y', values: [10, 20], config: { unit: 'y' } }) },
      size: { field: makeField({ name: 'sz', values: [0, 50] }), min: 2, max: 10, fixed: 5 },
    });
    const series2 = makeSeries({
      name: { value: 'Series B' },
      x: { field: makeField({ name: 'x', values: [3, 4] }) },
      y: { field: makeField({ name: 'y', values: [30, 40], config: { unit: 'y' } }) },
      size: { field: makeField({ name: 'sz', values: [50, 100] }), min: 2, max: 10, fixed: 5 },
    });
    const allSeries = [series1, series2];
    const { prepData } = prepConfig(allSeries, theme);
    const data = prepData!(allSeries);

    // global range min=0, max=100 spans both series
    const diams1 = data[1]![2] as number[];
    const diams2 = data[2]![2] as number[];
    expect(diams1[0]).toEqual(2);
    expect(diams2[1]).toEqual(10);
  });
});

describe('color field compilation', () => {
  function makeColorSeries(colorFieldConfig: Record<string, unknown>) {
    const colorField = makeField({ name: 'clr', values: [10, 50, 90], config: colorFieldConfig });
    return makeSeries({
      color: { field: colorField, fixed: '#ff0000' },
      x: { field: makeField({ name: 'x', values: [1, 2, 3] }) },
      y: { field: makeField({ name: 'y', values: [10, 20, 30], config: { unit: 'y' } }) },
    });
  }
  it('produces valid output with absolute threshold color config', () => {
    const series = makeColorSeries({
      color: { mode: FieldColorModeId.Thresholds },
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 30, color: 'yellow' },
          { value: 70, color: 'red' },
        ],
      },
    });

    const { prepData } = prepConfig([series], theme);
    const data = prepData!([series]);
    expect(data).toEqual([
      null,
      [
        [1, 2, 3],
        [10, 20, 30],
        [5, 5, 5],
        ['#ff0000', '#ff0000', '#ff0000'],
      ],
    ]);
  });

  it('produces valid output with value-to-text color mapping', () => {
    const series = makeColorSeries({
      mappings: [
        {
          type: MappingType.ValueToText,
          options: {
            '1': { text: 'low', color: 'green' },
            '2': { text: 'med', color: 'yellow' },
            '3': { text: 'high', color: 'red' },
          },
        },
      ],
    });

    const { prepData } = prepConfig([series], theme);
    const data = prepData!([series]);
    expect(data).toEqual([
      null,
      [
        [1, 2, 3],
        [10, 20, 30],
        [5, 5, 5],
        ['#ff0000', '#ff0000', '#ff0000'],
      ],
    ]);
  });

  it('produces valid output with range-to-text color mapping', () => {
    const series = makeColorSeries({
      mappings: [
        {
          type: MappingType.RangeToText,
          options: { from: 0, to: 50, result: { text: 'low', color: 'blue' } },
        },
        {
          type: MappingType.RangeToText,
          options: { from: 51, to: 100, result: { text: 'high', color: 'red' } },
        },
      ],
    });

    const { prepData } = prepConfig([series], theme);
    const data = prepData!([series]);
    expect(data).toEqual([
      null,
      [
        [1, 2, 3],
        [10, 20, 30],
        [5, 5, 5],
        ['#ff0000', '#ff0000', '#ff0000'],
      ],
    ]);
  });

  it.each([
    ['NaN', SpecialValueMatch.NaN],
    ['Null', SpecialValueMatch.Null],
  ])('produces valid output with special value %s color mapping', (_label, match) => {
    const series = makeColorSeries({
      mappings: [{ type: MappingType.SpecialValue, options: { match, result: { text: 'special', color: 'gray' } } }],
    });

    const { prepData } = prepConfig([series], theme);
    const data = prepData!([series]);
    expect(data).toEqual([
      null,
      [
        [1, 2, 3],
        [10, 20, 30],
        [5, 5, 5],
        ['#ff0000', '#ff0000', '#ff0000'],
      ],
    ]);
  });

  it('produces valid output with continuous gradient color mode', () => {
    const series = makeColorSeries({
      color: { mode: FieldColorModeId.ContinuousGrYlRd },
    });

    const { prepData } = prepConfig([series], theme);
    const data = prepData!([series]);
    expect(data).toEqual([
      null,
      [
        [1, 2, 3],
        [10, 20, 30],
        [5, 5, 5],
        ['#ff0000', '#ff0000', '#ff0000'],
      ],
    ]);
  });
});

describe('paletteHasAlpha', () => {
  // Regression: field.display.colors() returns asHexString-normalized colors — hex6
  // for opaque, hex8 only when an alpha channel is present. Opaque hex6 colors must NOT
  // be treated as having alpha, otherwise the fill-opacity slider is silently skipped
  // for color-by-field scatter. (The previous `!endsWith('ff')` check flagged opaque
  // hex6 like '#73bf69' as having alpha.)
  it('is false for opaque hex6 colors (so the opacity slider still applies)', () => {
    expect(paletteHasAlpha(['#73bf69', '#f2495c', '#5794f2'])).toBe(false);
    // an opaque color whose blue channel happens to be ff is still opaque
    expect(paletteHasAlpha(['#0000ff'])).toBe(false);
  });

  it('is false for an empty palette', () => {
    expect(paletteHasAlpha([])).toBe(false);
  });

  it('is true when a color carries a non-opaque alpha byte (hex8)', () => {
    expect(paletteHasAlpha(['#73bf6980'])).toBe(true);
    expect(paletteHasAlpha(['#73bf69', '#73bf6900'])).toBe(true); // mixed opaque + transparent
  });

  it('treats fully-opaque hex8 (#rrggbbff) as opaque', () => {
    expect(paletteHasAlpha(['#73bf69ff'])).toBe(false);
    expect(paletteHasAlpha(['#73BF69FF'])).toBe(false); // case-insensitive
  });
});
