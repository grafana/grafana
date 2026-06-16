import { createDataFrame } from '../dataframe/processDataFrame';
import { createTheme } from '../themes/createTheme';
import { type DataFrame, FieldType } from '../types/dataFrame';
import { ThresholdsMode } from '../types/thresholds';
import { MappingType } from '../types/valueMapping';

import { FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';
import { applyFieldOverrides } from './fieldOverrides';

// applyFieldOverrides wraps field.display in cachingDisplayProcessor. This verifies
// the selective resolvers survive that wrapping: display.color(v) is attached and
// equals the cached, hex-normalized display(v).color.
function withOverrides(frame: DataFrame): DataFrame {
  return applyFieldOverrides({
    data: [frame],
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (v) => v,
    theme: createTheme(),
    fieldConfigRegistry: new FieldConfigOptionsRegistry(),
  })[0];
}

describe('cached display selective resolvers', () => {
  it('display.color equals the cached, hex-normalized display(v).color (value mappings)', () => {
    const frame = withOverrides(
      createDataFrame({
        fields: [
          {
            name: 'status',
            type: FieldType.number,
            values: [1, 2, 3],
            config: {
              mappings: [
                {
                  type: MappingType.ValueToText,
                  options: { '1': { color: 'green' }, '2': { color: 'yellow' }, '3': { color: 'red' } },
                },
              ],
            },
          },
        ],
      })
    );

    const { display } = frame.fields[0];
    expect(display!.color).toBeDefined();

    for (const v of [1, 2, 3, 4]) {
      const cached = display!(v).color;
      expect(display!.color!(v)).toEqual(cached);
      // cached colors are hex-normalized (hex6/hex8)
      expect(display!.color!(v)).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i);
    }
  });

  it('display.color equals display(v).color (thresholds)', () => {
    const frame = withOverrides(
      createDataFrame({
        fields: [
          {
            name: 'v',
            type: FieldType.number,
            values: [10, 60, 90],
            config: {
              thresholds: {
                mode: ThresholdsMode.Absolute,
                steps: [
                  { value: -Infinity, color: 'green' },
                  { value: 50, color: 'yellow' },
                  { value: 80, color: 'red' },
                ],
              },
            },
          },
        ],
      })
    );

    const { display } = frame.fields[0];
    const values = [10, 60, 90];

    for (const v of values) {
      expect(display!.color!(v)).toEqual(display!(v).color);
    }
  });
});
