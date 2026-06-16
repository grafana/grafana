import { createTheme } from '../themes/createTheme';
import { type Field, type FieldConfig, FieldType } from '../types/dataFrame';
import { FieldColorModeId } from '../types/fieldColor';
import { ThresholdsMode } from '../types/thresholds';
import { MappingType, SpecialValueMatch } from '../types/valueMapping';

import { getDisplayProcessor } from './displayProcessor';

// Proves the selective resolvers added to DisplayProcessor are equivalent to the
// full processor: display.color(v) === display(v).color and display.text(v) ===
// display(v).text. The full-path color baseline itself is pinned in displayProcessor.color.test.ts.
const theme = createTheme();

function field(config: FieldConfig, type: FieldType = FieldType.number, values: unknown[] = []): Field {
  return { name: 'test', type, config, values, state: {} } as Field;
}

interface Scenario {
  name: string;
  field: Field;
  values: unknown[];
}

const scenarios: Scenario[] = [
  {
    name: 'ValueToText mapping',
    field: field({
      mappings: [
        {
          type: MappingType.ValueToText,
          options: { '1': { color: 'green' }, '2': { color: 'yellow' }, '3': { color: 'red' } },
        },
      ],
    }),
    values: [1, 2, 3, 4, null],
  },
  {
    name: 'RangeToText mapping',
    field: field({
      mappings: [
        { type: MappingType.RangeToText, options: { from: 0, to: 50, result: { color: 'blue' } } },
        { type: MappingType.RangeToText, options: { from: 51, to: 100, result: { color: 'red' } } },
      ],
    }),
    values: [10, 75, 200, null],
  },
  {
    name: 'RangeToText preceding ValueToText (order-sensitive)',
    field: field({
      mappings: [
        { type: MappingType.RangeToText, options: { from: 0, to: 10, result: { color: 'red' } } },
        { type: MappingType.ValueToText, options: { '5': { color: 'green' } } },
      ],
    }),
    // 5 is in 0..10 so RangeToText wins (red), NOT the ValueToText green — the case a
    // naive value->color precompute would get wrong.
    values: [5, 20],
  },
  {
    name: 'SpecialValue mappings',
    field: field({
      mappings: [
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.NaN, result: { color: 'orange' } } },
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.Null, result: { color: 'purple' } } },
        { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.Empty, result: { color: 'blue' } } },
      ],
    }),
    values: [NaN, null, '', 5],
  },
  {
    name: 'RegexToText mapping',
    field: field(
      {
        mappings: [
          { type: MappingType.RegexToText, options: { pattern: '/^foo/', result: { text: 'm', color: 'orange' } } },
        ],
      },
      FieldType.string
    ),
    values: ['foobar', 'baz'],
  },
  {
    name: 'absolute thresholds',
    field: field({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 50, color: 'yellow' },
          { value: 80, color: 'red' },
        ],
      },
    }),
    values: [10, 50, 79, 80, 100, null],
  },
  {
    name: 'percentage thresholds',
    field: field({
      min: 0,
      max: 200,
      thresholds: {
        mode: ThresholdsMode.Percentage,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 50, color: 'yellow' },
          { value: 90, color: 'red' },
        ],
      },
    }),
    values: [50, 100, 190],
  },
  {
    name: 'continuous gradient',
    field: field({ color: { mode: FieldColorModeId.ContinuousGrYlRd } }, FieldType.number, [0, 50, 100]),
    values: [0, 25, 50, 75, 100],
  },
  {
    name: 'boolean',
    field: field({}, FieldType.boolean, [true, false]),
    values: [true, false],
  },
  {
    name: 'enum with configured colors',
    field: field({ type: { enum: { text: ['A', 'B', 'C'], color: ['#aaa', '#bbb', '#ccc'] } } }, FieldType.enum),
    values: [0, 1, 2, null],
  },
  {
    name: 'enum with palette fallback',
    field: field({ type: { enum: { text: ['A', 'B', 'C'] } } }, FieldType.enum),
    values: [0, 1, 2, null],
  },
  {
    name: 'plain number (no mappings/thresholds)',
    field: field({}, FieldType.number, [1, 2, 3]),
    values: [1, 2, 3, null],
  },
  {
    name: 'string field',
    field: field({}, FieldType.string),
    values: ['a', 'b'],
  },
];

describe.each(scenarios)('selective resolvers — $name', ({ field: f, values }) => {
  const dp = getDisplayProcessor({ field: f, theme });

  it('display.color(v) === display(v).color for every value', () => {
    for (const v of values) {
      expect(dp.color!(v)).toEqual(dp(v).color);
    }
  });

  it('display.text(v) === display(v).text for every value', () => {
    for (const v of values) {
      expect(dp.text!(v)).toEqual(dp(v).text);
    }
  });
});
