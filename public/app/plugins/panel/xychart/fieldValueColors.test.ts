import { createDataFrame, createTheme, FieldType, MappingType, SpecialValueMatch, ThresholdsMode } from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

import { getEnumConfig } from './scatter';

// Golden baseline for the value-to-state compiler. We snapshot the deduped color
// palette plus the resolved color per representative value via getAll (the path the
// renderer uses), and assert getOne agrees with getAll for discrete compilers.
const theme = createTheme();

function makeColorField(config: Record<string, unknown>, values: unknown[], type: FieldType = FieldType.number) {
  return createDataFrame({
    fields: [{ name: 'clr', type, values, config }],
  }).fields[0];
}

/**
 * Resolved color per value via getAll (the path the renderer actually uses in
 * prepData), plus the palette, in a snapshot-friendly shape. For discrete
 * compilers (mappings/thresholds) getOne is also compiled, so we assert it
 * agrees with getAll. Continuous gradients only compile getAll — getOne stays
 * the -1 default there — so callers pass discrete=false to skip that check.
 */
function resolve(
  config: Record<string, unknown>,
  values: unknown[],
  opts: { type?: FieldType; min?: number; max?: number; discrete?: boolean } = {}
) {
  const { type, min, max, discrete = true } = opts;
  const field = makeColorField(config, values, type);
  const { index, getOne, getAll } = getEnumConfig(field, theme);
  const palette = index.color ?? [];

  const byAll = getAll(values, min, max).map((i) => palette[i] ?? null);

  if (discrete) {
    const byOne = values.map((v) => palette[getOne(v, min, max)] ?? null);
    expect(byOne).toEqual(byAll);
  }

  return { palette, colors: byAll };
}

describe('fieldValueColors (golden baseline)', () => {
  it('ValueToText mapping', () => {
    const config = {
      mappings: [
        {
          type: MappingType.ValueToText,
          options: {
            '1': { text: 'low', color: 'green' },
            '2': { text: 'mid', color: 'yellow' },
            '3': { text: 'high', color: 'red' },
          },
        },
      ],
    };
    expect(resolve(config, [1, 2, 3, 4])).toMatchSnapshot();
  });

  it('RangeToText mapping', () => {
    const config = {
      mappings: [
        { type: MappingType.RangeToText, options: { from: 0, to: 50, result: { text: 'low', color: 'blue' } } },
        { type: MappingType.RangeToText, options: { from: 51, to: 100, result: { text: 'high', color: 'red' } } },
      ],
    };
    expect(resolve(config, [10, 75, 200])).toMatchSnapshot();
  });

  it('formats generated range mapping labels with the field unit', () => {
    const field = makeColorField(
      {
        unit: 'percent',
        mappings: [
          {
            type: MappingType.RangeToText,
            options: { from: 0, to: 50, result: { color: 'blue' } },
          },
        ],
      },
      [25]
    );

    expect(getEnumConfig(field, theme).index.text).toEqual(['0% - 50%']);
  });

  it('SpecialValue mapping (NaN / Null)', () => {
    const config = {
      mappings: [
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.NaN, result: { color: 'orange' } } },
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.Null, result: { color: 'purple' } } },
      ],
    };
    expect(resolve(config, [NaN, null, 5])).toMatchSnapshot();
  });

  it('absolute thresholds', () => {
    const config = {
      color: { mode: FieldColorModeId.Thresholds },
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 50, color: 'yellow' },
          { value: 80, color: 'red' },
        ],
      },
    };
    expect(resolve(config, [10, 50, 79, 80, 100])).toMatchSnapshot();
  });

  it('formats absolute threshold labels with the field unit', () => {
    const field = makeColorField(
      {
        unit: 'percent',
        color: { mode: FieldColorModeId.Thresholds },
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 50, color: 'red' },
          ],
        },
      },
      [25, 75]
    );

    expect(getEnumConfig(field, theme).index.text).toEqual(['< 50%', '≥ 50%']);
  });

  it('percentage thresholds', () => {
    const config = {
      min: 0,
      max: 200,
      color: { mode: FieldColorModeId.Thresholds },
      thresholds: {
        mode: ThresholdsMode.Percentage,
        steps: [
          { value: 0, color: 'green' },
          { value: 50, color: 'yellow' },
          { value: 80, color: 'red' },
        ],
      },
    };

    const field = makeColorField(config, [0, 100, 159, 160, 200]);
    const { index, getAll } = getEnumConfig(field, theme);

    expect(index).toEqual({
      color: ['#73bf69ff', '#fade2aff', '#f2495cff'],
      text: ['0%+', '50%+', '80%+'],
      icon: ['', '', ''],
    });
    expect(getAll(field.values)).toEqual([0, 1, 1, 2, 2]);
    expect(getAll(field.values, 0, 100)).toEqual([0, 1, 1, 2, 2]);
  });

  it('continuous gradient (needs min/max)', () => {
    const config = { color: { mode: FieldColorModeId.ContinuousGrYlRd } };
    expect(
      resolve(config, [0, 50, 100], { type: FieldType.number, min: 0, max: 100, discrete: false })
    ).toMatchSnapshot();
  });

  it('RegexToText mapping', () => {
    const config = {
      mappings: [
        { type: MappingType.RegexToText, options: { pattern: '/^foo/', result: { text: 'm', color: 'orange' } } },
      ],
    };
    expect(resolve(config, ['foobar', 'baz'], { type: FieldType.string })).toMatchSnapshot();
  });

  it('ValueToText mapping on a string field (compares against quoted keys)', () => {
    const config = {
      mappings: [
        {
          type: MappingType.ValueToText,
          options: {
            a: { text: 'Apple', color: 'green' },
            b: { text: 'Banana', color: 'yellow' },
          },
        },
      ],
    };
    expect(resolve(config, ['a', 'b', 'c'], { type: FieldType.string })).toMatchSnapshot();
  });

  it('ValueToText mapping entries without a color use the fallback color', () => {
    const config = {
      mappings: [
        {
          type: MappingType.ValueToText,
          options: {
            '1': { text: 'one' },
            '2': { text: 'two', color: 'red' },
          },
        },
      ],
    };
    expect(resolve(config, [1, 2])).toMatchSnapshot();
  });

  it('RangeToText with open-ended and unbounded ranges', () => {
    const config = {
      mappings: [
        { type: MappingType.RangeToText, options: { from: 10, result: { color: 'green' } } }, // v >= 10
        { type: MappingType.RangeToText, options: { to: 5, result: { color: 'blue' } } }, // v <= 5
        { type: MappingType.RangeToText, options: { result: { color: 'red' } } },
      ],
    };
    expect(resolve(config, [3, 7, 20])).toMatchSnapshot();
  });

  it('SpecialValue mapping (NullAndNaN / Empty)', () => {
    const config = {
      mappings: [
        {
          type: MappingType.SpecialValue,
          options: { match: SpecialValueMatch.NullAndNaN, result: { color: 'green' } },
        },
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.Empty, result: { color: 'blue' } } },
      ],
    };
    expect(resolve(config, [null, NaN, '', 5])).toMatchSnapshot();
  });

  it('SpecialValue mapping (True / False)', () => {
    const config = {
      mappings: [
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.True, result: { color: 'green' } } },
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.False, result: { color: 'red' } } },
      ],
    };
    expect(resolve(config, [true, false], { type: FieldType.boolean })).toMatchSnapshot();
  });

  it('SpecialValue mapping result without a color uses the fallback color', () => {
    const config = {
      mappings: [
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.NaN, result: {} } },
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.Null, result: { color: 'purple' } } },
      ],
    };
    expect(resolve(config, [NaN, null])).toMatchSnapshot();
  });

  it('SpecialValue Null matches both null and undefined (loose ==)', () => {
    const config = {
      mappings: [
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.Null, result: { color: 'purple' } } },
      ],
    };
    expect(resolve(config, [null, undefined, 0])).toMatchSnapshot();
  });

  it('no color branch taken yields the empty defaults (getAll -> [], getOne -> -1)', () => {
    // color field present but no mappings, no thresholds mode, no continuous mode:
    // conds stays empty so getAll returns [] regardless of input length. discrete=false
    // because getOne (-1) and getAll ([]) cannot agree here by construction.
    const config = {};
    expect(resolve(config, [1, 2, 3], { discrete: false })).toMatchSnapshot();
  });

  it('single-step absolute thresholds do not create discrete states', () => {
    const config = {
      color: { mode: FieldColorModeId.Thresholds },
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [{ value: -Infinity, color: 'green' }],
      },
    };
    expect(resolve(config, [1, 100], { discrete: false })).toEqual({ palette: [], colors: [] });
  });
});
