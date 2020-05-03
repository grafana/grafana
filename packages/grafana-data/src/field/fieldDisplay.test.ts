import merge from 'lodash/merge';
import { getFieldDisplayValues, GetFieldDisplayValuesOptions, calculateFieldState } from './fieldDisplay';
import { toDataFrame } from '../dataframe/processDataFrame';
import { ReducerID } from '../transformations/fieldReducer';
import { ThresholdsMode } from '../types/thresholds';
import { GrafanaTheme } from '../types/theme';
import { DataFrame, FieldConfig, MappingType, TIME_SERIES_FIELD_NAME, FieldState, FieldType } from '../types';
import { validateFieldConfig } from './fieldOverrides';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';

describe('FieldDisplay', () => {
  beforeAll(() => {
    // Since FieldConfigEditors belong to grafana-ui we need to mock those here
    // as grafana-ui code cannot be imported in grafana-data.
    // TODO: figure out a way to share standard editors between data/ui tests
    const mappings = {
      id: 'mappings', // Match field properties
      process: (value: any) => value,
      shouldApply: () => true,
    } as any;

    standardFieldConfigEditorRegistry.setInit(() => {
      return [mappings];
    });
  });

  it('show first numeric values', () => {
    const options = createDisplayOptions({
      reduceOptions: {
        calcs: [ReducerID.first],
      },
      fieldConfig: {
        overrides: [],
        defaults: {
          title: '$__cell_0 * $__field_name * $__series_name',
        },
      },
    });
    const display = getFieldDisplayValues(options);
    expect(display.map(v => v.display.text)).toEqual(['1', '2']);
  });

  it('show last numeric values', () => {
    const options = createDisplayOptions({
      reduceOptions: {
        calcs: [ReducerID.last],
      },
    });
    const display = getFieldDisplayValues(options);
    expect(display.map(v => v.display.numeric)).toEqual([5, 6]);
  });

  it('show all numeric values', () => {
    const options = createDisplayOptions({
      reduceOptions: {
        values: true, //
        limit: 1000,
        calcs: [],
      },
    });
    const display = getFieldDisplayValues(options);
    expect(display.map(v => v.display.numeric)).toEqual([1, 3, 5, 2, 4, 6]);
  });

  it('show 2 numeric values (limit)', () => {
    const options = createDisplayOptions({
      reduceOptions: {
        values: true, //
        limit: 2,
        calcs: [],
      },
    });
    const display = getFieldDisplayValues(options);
    expect(display.map(v => v.display.numeric)).toEqual([1, 3]); // First 2 are from the first field
  });

  it('should restore -Infinity value for base threshold', () => {
    const config: FieldConfig = {
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          {
            color: '#73BF69',
            value: (null as any) as number, // -Infinity becomes null in JSON
          },
          {
            color: '#F2495C',
            value: 50,
          },
        ],
      },
    };
    validateFieldConfig(config);
    expect(config.thresholds!.steps.length).toEqual(2);
    expect(config.thresholds!.steps[0].value).toBe(-Infinity);
  });

  it('Should return field thresholds when there is no data', () => {
    const options = createEmptyDisplayOptions({
      fieldConfig: {
        defaults: {
          thresholds: { steps: [{ color: '#F2495C', value: 50 }] },
        },
      },
    });

    const display = getFieldDisplayValues(options);
    expect(display[0].field.thresholds!.steps!.length).toEqual(1);
    expect(display[0].display.numeric).toEqual(0);
  });

  it('Should return field with default text when no mapping or data available', () => {
    const options = createEmptyDisplayOptions();
    const display = getFieldDisplayValues(options);
    expect(display[0].display.text).toEqual('No data');
    expect(display[0].display.numeric).toEqual(0);
  });

  it('Should return field mapped value when there is no data', () => {
    const mapEmptyToText = '0';
    const options = createEmptyDisplayOptions({
      fieldConfig: {
        defaults: {
          mappings: [
            {
              id: 1,
              operator: '',
              text: mapEmptyToText,
              type: MappingType.ValueToText,
              value: 'null',
            },
          ],
        },
      },
    });

    const display = getFieldDisplayValues(options);
    expect(display[0].display.text).toEqual(mapEmptyToText);
    expect(display[0].display.numeric).toEqual(0);
  });

  it('Should always return display numeric 0 when there is no data', () => {
    const mapEmptyToText = '0';
    const options = createEmptyDisplayOptions({
      fieldConfig: {
        overrides: {
          mappings: [
            {
              id: 1,
              operator: '',
              text: mapEmptyToText,
              type: MappingType.ValueToText,
              value: 'null',
            },
          ],
        },
      },
    });

    const display = getFieldDisplayValues(options);
    expect(display[0].display.numeric).toEqual(0);
  });

  describe('Value mapping', () => {
    it('should apply value mapping', () => {
      const mappingConfig = [
        {
          id: 1,
          operator: '',
          text: 'Value mapped to text',
          type: MappingType.ValueToText,
          value: '1',
        },
      ];
      const options = createDisplayOptions({
        reduceOptions: {
          calcs: [ReducerID.first],
        },
      });

      options.data![0].fields[1]!.config = { mappings: mappingConfig };
      options.data![0].fields[2]!.config = { mappings: mappingConfig };

      const result = getFieldDisplayValues(options);
      expect(result[0].display.text).toEqual('Value mapped to text');
    });
    it('should apply range value mapping', () => {
      const mappedValue = 'Range mapped to text';
      const mappingConfig = [
        {
          id: 1,
          operator: '',
          text: mappedValue,
          type: MappingType.RangeToText,
          value: 1,
          from: '1',
          to: '3',
        },
      ];
      const options = createDisplayOptions({
        reduceOptions: {
          calcs: [ReducerID.first],
          values: true,
        },
      });

      options.data![0].fields[1]!.config = { mappings: mappingConfig };
      options.data![0].fields[2]!.config = { mappings: mappingConfig };

      const result = getFieldDisplayValues(options);

      expect(result[0].display.text).toEqual(mappedValue);
      expect(result[2].display.text).toEqual('5');
      expect(result[3].display.text).toEqual(mappedValue);
    });
  });
});

interface TitleScenario {
  frames: DataFrame[];
  frameIndex?: number; // assume 0
  fieldIndex?: number; // assume 0
}

function checkScenario(scenario: TitleScenario): FieldState {
  const frame = scenario.frames[scenario.frameIndex ?? 0];
  const field = frame.fields[scenario.fieldIndex ?? 0];
  return calculateFieldState(field, frame, scenario.frames);
}

describe('Check field state calculations (title and id)', () => {
  it('should use field name if no frame name', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: 'Field 1' }],
        }),
      ],
    });
    expect(state.title).toEqual('Field 1');
  });

  it('should use only field name if only one series', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          name: 'Series A',
          fields: [{ name: 'Field 1' }],
        }),
      ],
    });
    expect(state.title).toEqual('Field 1');
  });

  it('should use frame name and field name if more than one frame', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          name: 'Series A',
          fields: [{ name: 'Field 1' }],
        }),
        toDataFrame({
          name: 'Series B',
          fields: [{ name: 'Field 1' }],
        }),
      ],
    });
    expect(state.title).toEqual('Series A Field 1');
  });

  it('should only use label value if only one label', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: 'Value', labels: { server: 'Server A' } }],
        }),
      ],
    });
    expect(state.title).toEqual('Server A');
  });

  it('should use label value only if all series have same name', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          name: 'cpu',
          fields: [{ name: 'Value', labels: { server: 'Server A' } }],
        }),
        toDataFrame({
          name: 'cpu',
          fields: [{ name: 'Value', labels: { server: 'Server A' } }],
        }),
      ],
    });
    expect(state.title).toEqual('Server A');
  });

  it('should use label name and value if more than one label', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: 'Value', labels: { server: 'Server A', mode: 'B' } }],
        }),
      ],
    });
    expect(state.title).toEqual('{mode="B", server="Server A"}');
  });

  it('should use field name even when it is TIME_SERIES_FIELD_NAME if there are no labels', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: TIME_SERIES_FIELD_NAME, labels: {} }],
        }),
      ],
    });
    expect(state.title).toEqual('Value');
  });

  it('should use series name when field name is TIME_SERIES_FIELD_NAME and there are no labels ', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          name: 'Series A',
          fields: [{ name: TIME_SERIES_FIELD_NAME, labels: {} }],
        }),
      ],
    });
    expect(state.title).toEqual('Series A');
  });

  it('should reder loki frames', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time },
            {
              name: 'line',
              labels: { host: 'ec2-13-53-116-156.eu-north-1.compute.amazonaws.com', region: 'eu-north1' },
            },
          ],
        }),
      ],
      fieldIndex: 1,
    });
    expect(state.title).toEqual('line {host="ec2-13-53-116-156.eu-north-1.compute.amazonaws.com", region="eu-north1"}');
  });
});

function createEmptyDisplayOptions(extend = {}): GetFieldDisplayValuesOptions {
  const options = createDisplayOptions(extend);

  return Object.assign(options, {
    data: [
      {
        name: 'No data',
        fields: [],
        length: 0,
      },
    ],
  });
}

function createDisplayOptions(extend: Partial<GetFieldDisplayValuesOptions> = {}): GetFieldDisplayValuesOptions {
  const options: GetFieldDisplayValuesOptions = {
    data: [
      toDataFrame({
        name: 'Series Name',
        fields: [
          { name: 'Field 1', values: ['a', 'b', 'c'] },
          { name: 'Field 2', values: [1, 3, 5] },
          { name: 'Field 3', values: [2, 4, 6] },
        ],
      }),
    ],
    replaceVariables: (value: string) => {
      return value;
    },
    reduceOptions: {
      calcs: [],
    },
    fieldConfig: {
      overrides: [],
      defaults: {},
    },
    theme: {} as GrafanaTheme,
  };

  return merge<GetFieldDisplayValuesOptions, any>(options, extend);
}
