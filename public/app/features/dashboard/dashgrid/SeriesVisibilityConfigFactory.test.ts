import { ByNamesMatcherMode, FieldMatcherID, FieldType, type FieldConfigSource, toDataFrame } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';

import { seriesVisibilityConfigFactory } from './SeriesVisibilityConfigFactory';

describe('seriesVisibilityConfigFactory', () => {
  it('keeps boolean series hidden when appending numeric series to an isolated selection', () => {
    const data = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: 'Number1', type: FieldType.number, values: [1, 2] },
          { name: 'Number2', type: FieldType.number, values: [3, 4] },
          { name: 'Boolean1', type: FieldType.boolean, values: [true, false] },
          { name: 'Boolean2', type: FieldType.boolean, values: [false, true] },
        ],
      }),
    ];

    const isolated = seriesVisibilityConfigFactory(
      'Number1',
      SeriesVisibilityChangeMode.ToggleSelection,
      emptyFieldConfig(),
      data
    );

    const next = seriesVisibilityConfigFactory('Number2', SeriesVisibilityChangeMode.AppendToSelection, isolated, data);

    expect(next.overrides).toHaveLength(1);
    expect(next.overrides[0].matcher).toEqual({
      id: FieldMatcherID.byNames,
      options: {
        mode: ByNamesMatcherMode.exclude,
        names: ['Number1', 'Number2'],
        prefix: 'All except:',
        readOnly: true,
      },
    });
  });

  it('keeps enum series hidden when appending numeric series to an isolated selection', () => {
    const data = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: 'Number1', type: FieldType.number, values: [1, 2] },
          { name: 'Number2', type: FieldType.number, values: [3, 4] },
          {
            name: 'Enum1',
            type: FieldType.enum,
            values: [0, 1],
            config: { type: { enum: { text: ['Low', 'High'] } } },
          },
          {
            name: 'Enum2',
            type: FieldType.enum,
            values: [1, 0],
            config: { type: { enum: { text: ['Stopped', 'Running'] } } },
          },
        ],
      }),
    ];

    const isolated = seriesVisibilityConfigFactory(
      'Number1',
      SeriesVisibilityChangeMode.ToggleSelection,
      emptyFieldConfig(),
      data
    );

    const next = seriesVisibilityConfigFactory('Number2', SeriesVisibilityChangeMode.AppendToSelection, isolated, data);

    expect(next.overrides).toHaveLength(1);
    expect(next.overrides[0].matcher).toEqual({
      id: FieldMatcherID.byNames,
      options: {
        mode: ByNamesMatcherMode.exclude,
        names: ['Number1', 'Number2'],
        prefix: 'All except:',
        readOnly: true,
      },
    });
  });

  it('keeps enum series visible when appending enum series to an isolated selection', () => {
    const data = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: 'Number1', type: FieldType.number, values: [1, 2] },
          {
            name: 'Enum1',
            type: FieldType.enum,
            values: [0, 1],
            config: { type: { enum: { text: ['Low', 'High'] } } },
          },
          {
            name: 'Enum2',
            type: FieldType.enum,
            values: [1, 0],
            config: { type: { enum: { text: ['Stopped', 'Running'] } } },
          },
        ],
      }),
    ];

    const isolated = seriesVisibilityConfigFactory(
      'Enum1',
      SeriesVisibilityChangeMode.ToggleSelection,
      emptyFieldConfig(),
      data
    );

    const next = seriesVisibilityConfigFactory('Enum2', SeriesVisibilityChangeMode.AppendToSelection, isolated, data);

    expect(next.overrides).toHaveLength(1);
    expect(next.overrides[0].matcher).toEqual({
      id: FieldMatcherID.byNames,
      options: {
        mode: ByNamesMatcherMode.exclude,
        names: ['Enum1', 'Enum2'],
        prefix: 'All except:',
        readOnly: true,
      },
    });
  });

  it('keeps numeric, boolean, and enum series in the isolated selection', () => {
    const data = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: 'Number1', type: FieldType.number, values: [1, 2] },
          { name: 'Number2', type: FieldType.number, values: [3, 4] },
          { name: 'Boolean1', type: FieldType.boolean, values: [true, false] },
          {
            name: 'Enum1',
            type: FieldType.enum,
            values: [0, 1],
            config: { type: { enum: { text: ['Low', 'High'] } } },
          },
        ],
      }),
    ];

    const isolated = seriesVisibilityConfigFactory(
      'Number1',
      SeriesVisibilityChangeMode.ToggleSelection,
      emptyFieldConfig(),
      data
    );

    const next = seriesVisibilityConfigFactory('Number2', SeriesVisibilityChangeMode.AppendToSelection, isolated, data);

    expect(next.overrides).toHaveLength(1);
    expect(next.overrides[0].matcher).toEqual({
      id: FieldMatcherID.byNames,
      options: {
        mode: ByNamesMatcherMode.exclude,
        names: ['Number1', 'Number2'],
        prefix: 'All except:',
        readOnly: true,
      },
    });
  });

  it('does not count time or string fields as series when all numeric series are visible', () => {
    const data = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: 'Number1', type: FieldType.number, values: [1, 2] },
          { name: 'Number2', type: FieldType.number, values: [3, 4] },
          { name: 'Label', type: FieldType.string, values: ['a', 'b'] },
        ],
      }),
    ];

    const isolated = seriesVisibilityConfigFactory(
      'Number1',
      SeriesVisibilityChangeMode.ToggleSelection,
      emptyFieldConfig(),
      data
    );

    const next = seriesVisibilityConfigFactory('Number2', SeriesVisibilityChangeMode.AppendToSelection, isolated, data);

    expect(next.overrides).toHaveLength(0);
  });
});

function emptyFieldConfig(): FieldConfigSource {
  return { defaults: {}, overrides: [] };
}
