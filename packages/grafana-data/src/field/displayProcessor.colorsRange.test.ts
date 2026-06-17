import { createTheme } from '../themes/createTheme';
import { type Field, type FieldConfig, FieldType } from '../types/dataFrame';
import { FieldColorModeId } from '../types/fieldColor';
import { ThresholdsMode } from '../types/thresholds';
import { MappingType } from '../types/valueMapping';

import { getDisplayProcessor } from './displayProcessor';
import { getFieldColorModeForField } from './fieldColor';

// display.colors(values, min, max) batches value->color with palette dedup. For
// continuous by-value modes a caller-supplied range lets several series share one
// color scale (scatter colors all points on a global range); discrete modes ignore
// the range. This covers the range-aware path that single-value .color() can't express.
const theme = createTheme();

function field(config: FieldConfig, type: FieldType = FieldType.number, values: unknown[] = []): Field {
  return { name: 'test', type, config, values, state: {} } as Field;
}

describe('display.colors(values, min, max)', () => {
  it('continuous: interpolates each value against the supplied shared range', () => {
    const f = field({ color: { mode: FieldColorModeId.ContinuousGrYlRd } }, FieldType.number, [0, 50, 100]);
    const dp = getDisplayProcessor({ field: f, theme });
    const calc = getFieldColorModeForField(f).getCalculator(f, theme);

    const values = [0, 50, 100];
    const { palette, indices } = dp.colors!(values, 0, 100);
    const colors = indices.map((i) => palette[i]);

    // each color is the calculator evaluated at percent = (v - min) / (max - min)
    expect(colors).toEqual([calc(0, 0), calc(50, 0.5), calc(100, 1)]);
  });

  it('continuous: the same value gets different colors under different shared ranges', () => {
    const f = field({ color: { mode: FieldColorModeId.ContinuousGrYlRd } }, FieldType.number, [50]);
    const dp = getDisplayProcessor({ field: f, theme });
    const calc = getFieldColorModeForField(f).getCalculator(f, theme);

    const narrow = dp.colors!([50], 0, 100); // 50%
    const wide = dp.colors!([50], 0, 200); // 25%

    expect(narrow.palette[narrow.indices[0]]).toEqual(calc(50, 0.5));
    expect(wide.palette[wide.indices[0]]).toEqual(calc(50, 0.25));
    expect(narrow.palette[0]).not.toEqual(wide.palette[0]);
  });

  it('discrete value mappings ignore the supplied range', () => {
    const f = field({
      mappings: [
        {
          type: MappingType.ValueToText,
          options: { '1': { color: 'green' }, '2': { color: 'red' } },
        },
      ],
    });
    const dp = getDisplayProcessor({ field: f, theme });

    const a = dp.colors!([1, 2, 1], 0, 100);
    const b = dp.colors!([1, 2, 1], -999, 999);

    expect(a).toEqual(b); // range irrelevant for discrete
    expect(a.palette).toHaveLength(2); // deduped
    expect(a.indices).toEqual([0, 1, 0]);
  });

  it('absolute thresholds ignore the supplied range', () => {
    const f = field({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 50, color: 'red' },
        ],
      },
    });
    const dp = getDisplayProcessor({ field: f, theme });

    const a = dp.colors!([10, 60], 0, 1);
    const b = dp.colors!([10, 60], 0, 1000);

    expect(a).toEqual(b);
    // each value resolves to its single-value color
    expect(a.palette[a.indices[0]]).toEqual(dp.color!(10));
    expect(a.palette[a.indices[1]]).toEqual(dp.color!(60));
  });
});
