import { createTheme } from '../themes/createTheme';
import { type Field, type FieldConfig, FieldType } from '../types/dataFrame';
import { FieldColorModeId } from '../types/fieldColor';
import { ThresholdsMode } from '../types/thresholds';
import { MappingType, SpecialValueMatch, type ValueMapping } from '../types/valueMapping';

import { getDisplayProcessor } from './displayProcessor';
import { getScaleCalculator } from './scale';

// This suite pins down the `.color` of `field.display(value)` across every
// mapping / threshold / color-mode path. It is the baseline that the upcoming
// `field.display.color()` refactor must reproduce exactly (display(v).color
// stays identical, and display.color(v) === display(v).color). Expected colors
// are derived from the canonical sources display() delegates to today:
//   - value-mapping colors  -> theme.visualization.getColorByName(name)
//   - threshold/continuous  -> getScaleCalculator(field, theme)(value).color
const theme = createTheme();

function makeField(config: FieldConfig, type: FieldType = FieldType.number, values: unknown[] = []): Field {
  return { name: 'test', type, config, values, state: {} } as Field;
}

function colorOf(field: Field, value: unknown): string | undefined {
  return getDisplayProcessor({ field, theme })(value).color;
}

describe('display().color — value mappings', () => {
  it('ValueToText resolves the mapped named color', () => {
    const field = makeField({
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
    });

    expect(colorOf(field, 1)).toEqual(theme.visualization.getColorByName('green'));
    expect(colorOf(field, 2)).toEqual(theme.visualization.getColorByName('yellow'));
    expect(colorOf(field, 3)).toEqual(theme.visualization.getColorByName('red'));
  });

  it('RangeToText resolves color in-range and falls back out-of-range', () => {
    const field = makeField({
      mappings: [
        { type: MappingType.RangeToText, options: { from: 0, to: 50, result: { text: 'low', color: 'blue' } } },
        { type: MappingType.RangeToText, options: { from: 51, to: 100, result: { text: 'high', color: 'red' } } },
      ],
    });

    expect(colorOf(field, 10)).toEqual(theme.visualization.getColorByName('blue'));
    expect(colorOf(field, 75)).toEqual(theme.visualization.getColorByName('red'));
    // 200 matches no range -> no mapping color, no thresholds => -Infinity base color
    expect(colorOf(field, 200)).toEqual(getScaleCalculator(field, theme)(-Infinity).color);
  });

  it.each([
    ['NaN', SpecialValueMatch.NaN, NaN],
    ['Null', SpecialValueMatch.Null, null],
    ['Empty', SpecialValueMatch.Empty, ''],
    ['True', SpecialValueMatch.True, true],
    ['False', SpecialValueMatch.False, false],
  ])('SpecialValue %s resolves the mapped color', (_label, match, value) => {
    const field = makeField({
      mappings: [{ type: MappingType.SpecialValue, options: { match, result: { text: 'special', color: 'purple' } } }],
    });

    expect(colorOf(field, value)).toEqual(theme.visualization.getColorByName('purple'));
  });

  it('RegexToText resolves the mapped color', () => {
    const mappings: ValueMapping[] = [
      { type: MappingType.RegexToText, options: { pattern: '/^foo/', result: { text: 'matched', color: 'orange' } } },
    ];
    const field = makeField({ mappings }, FieldType.string);

    expect(colorOf(field, 'foobar')).toEqual(theme.visualization.getColorByName('orange'));
  });
});

describe('display().color — thresholds', () => {
  it('absolute thresholds pick the active step color', () => {
    const field = makeField({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 50, color: 'yellow' },
          { value: 80, color: 'red' },
        ],
      },
    });
    const scale = getScaleCalculator(field, theme);

    expect(colorOf(field, 10)).toEqual(scale(10).color);
    expect(colorOf(field, 50)).toEqual(scale(50).color); // boundary (>=)
    expect(colorOf(field, 79)).toEqual(scale(79).color);
    expect(colorOf(field, 80)).toEqual(scale(80).color); // boundary (>=)
    expect(colorOf(field, 100)).toEqual(scale(100).color);
  });

  it('percentage thresholds pick the active step color', () => {
    const field = makeField({
      min: 0,
      max: 200,
      thresholds: {
        mode: ThresholdsMode.Percentage,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 50, color: 'yellow' }, // 50% => value 100
          { value: 90, color: 'red' }, // 90% => value 180
        ],
      },
    });
    const scale = getScaleCalculator(field, theme);

    expect(colorOf(field, 50)).toEqual(scale(50).color); // 25%
    expect(colorOf(field, 100)).toEqual(scale(100).color); // 50% boundary
    expect(colorOf(field, 190)).toEqual(scale(190).color); // 95%
  });

  it('null value gets the -Infinity base color', () => {
    const field = makeField({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#000' },
          { value: 50, color: '#fff' },
        ],
      },
    });

    expect(colorOf(field, null)).toEqual(getScaleCalculator(field, theme)(-Infinity).color);
  });
});

describe('display().color — color modes', () => {
  it('continuous mode interpolates across the field range', () => {
    const values = [0, 50, 100];
    const field = makeField({ color: { mode: FieldColorModeId.ContinuousGrYlRd } }, FieldType.number, values);
    const scale = getScaleCalculator(field, theme);

    for (const v of values) {
      expect(colorOf(field, v)).toEqual(scale(v).color);
    }
  });

  it('boolean field resolves green/red', () => {
    const field = makeField({}, FieldType.boolean, [true, false]);

    expect(colorOf(field, true)).toEqual(theme.visualization.getColorByName('green'));
    expect(colorOf(field, false)).toEqual(theme.visualization.getColorByName('red'));
  });
});

describe('display().color — enum fields', () => {
  it('uses configured enum colors when present', () => {
    const field = makeField(
      { type: { enum: { text: ['A', 'B', 'C'], color: ['#aaa', '#bbb', '#ccc'] } } },
      FieldType.enum,
      [0, 1, 2]
    );

    expect(colorOf(field, 0)).toEqual('#aaa');
    expect(colorOf(field, 1)).toEqual('#bbb');
    expect(colorOf(field, 2)).toEqual('#ccc');
  });

  it('falls back to the theme palette by index when no enum colors configured', () => {
    const field = makeField({ type: { enum: { text: ['A', 'B', 'C'] } } }, FieldType.enum, [0, 1, 2]);
    const { palette } = theme.visualization;

    expect(colorOf(field, 0)).toEqual(theme.visualization.getColorByName(palette[0]));
    expect(colorOf(field, 1)).toEqual(theme.visualization.getColorByName(palette[1]));
  });
});
