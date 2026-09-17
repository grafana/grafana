import { toDataFrame, FieldType, DataTransformerID, transformDataFrame } from '@grafana/data';
import { mockTransformationsRegistry } from '@grafana/data/internal';

import {
  CustomCFQMatchers,
  getConfigFromDataTransformer,
  type ConfigFromQueryTransformOptions,
} from './configFromQuery';
import { extractConfigFromQueryDynamic } from './configFromQueryDynamic';

describe('config from data', () => {
  const config = toDataFrame({
    fields: [
      { name: 'Field Name', type: FieldType.string, values: ['col1', 'col2', 'col3'] },
      { name: 'Max', type: FieldType.number, values: [1, 10, 20] },
      { name: 'Color', type: FieldType.string, values: ['red', 'yellow', 'green'] },
    ],
    refId: 'A',
  });

  const seriesA = toDataFrame({
    fields: [
      { name: 'col1', type: FieldType.time, values: [1, 2, 3] },
      {
        name: 'Something',
        type: FieldType.number,
        values: [2, 3, 4],
        config: { displayName: 'col2' },
      },
      {
        name: 'col4',
        type: FieldType.number,
        values: [2, 3, 4],
      },
    ],
  });

  const options: ConfigFromQueryTransformOptions = {
    mappings: [
      { fieldName: 'Max', handlerKey: 'max' },
      { fieldName: 'Color', handlerKey: 'color' },
    ],
    configRefId: 'A',
    applyTo: {
      id: CustomCFQMatchers.dynamicFieldName,
      options: 'Field Name',
    },
  };

  it('Selects only the fields returned by the query', () => {
    const results = extractConfigFromQueryDynamic(options, [config, seriesA], config, options.mappings);
    expect(results.length).toBe(1);
    // 0 & 1 are matched (fieldName, display name)
    expect(results[0].fields[0]).not.toEqual(seriesA.fields[0]);
    expect(results[0].fields[1]).not.toEqual(seriesA.fields[1]);
    // 2 is not matched (col4 not in the config results)
    expect(results[0].fields[2]).toEqual(seriesA.fields[2]);
  });

  it('Maps row values onto data frame names', () => {
    const results = extractConfigFromQueryDynamic(options, [config, seriesA], config, options.mappings);
    expect(results.length).toBe(1);
    expect(results[0].fields[0].config.color).toEqual({ fixedColor: 'red', mode: 'fixed' });
    expect(results[0].fields[1].config.color).toEqual({ fixedColor: 'yellow', mode: 'fixed' });
    expect(results[0].fields[0].config.max).toEqual(1);
    expect(results[0].fields[1].config.max).toEqual(10);
  });
});

describe('transformer operator pipeline', () => {
  beforeAll(() => {
    mockTransformationsRegistry([getConfigFromDataTransformer()]);
  });

  it('should apply config via the operator', async () => {
    const config = toDataFrame({
      fields: [
        { name: 'Field Name', type: FieldType.string, values: ['col1', 'col2'] },
        { name: 'Color', type: FieldType.string, values: ['red', 'green'] },
      ],
      refId: 'config',
    });

    const series = toDataFrame({
      fields: [
        { name: 'col1', type: FieldType.time, values: [1, 2, 3] },
        { name: 'col2', type: FieldType.time, values: [1, 2, 3] },
      ],
      refId: 'A',
    });
    series.name = 'throughput';

    const cfg = {
      id: DataTransformerID.configFromData,
      options: {
        configRefId: 'config',
        applyTo: {
          id: CustomCFQMatchers.dynamicFieldName,
          options: 'Field Name',
        },
        mappings: [{ fieldName: 'Color', handlerKey: 'color' }],
      },
    };

    await expect(transformDataFrame([cfg], [config, series])).toEmitValuesWith((received) => {
      const result = received[0];
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('throughput');
      expect(result[0].fields[0].config.color).toStrictEqual({ fixedColor: 'red', mode: 'fixed' });
      expect(result[0].fields[1].config.color).toStrictEqual({ fixedColor: 'green', mode: 'fixed' });
    });
  });
});
