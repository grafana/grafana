import { toDataFrame, FieldType, ReducerID, DataTransformerID, transformDataFrame } from '@grafana/data';
import { mockTransformationsRegistry } from '@grafana/data/internal';

import { FieldConfigHandlerKey } from '../fieldToConfigMapping/fieldToConfigMapping';

import {
  extractConfigFromQuery,
  getConfigFromDataTransformer,
  ConfigFromQueryTransformOptions,
} from './configFromQuery';

describe('config from data', () => {
  const config = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [1, 2] },
      { name: 'Max', type: FieldType.number, values: [1, 10, 50] },
      { name: 'Min', type: FieldType.number, values: [1, 10, 5] },
      { name: 'Names', type: FieldType.string, values: ['first-name', 'middle', 'last-name'] },
    ],
    refId: 'A',
  });

  const seriesA = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
      {
        name: 'Value',
        type: FieldType.number,
        values: [2, 3, 4],
        config: { displayName: 'SeriesA' },
      },
    ],
  });

  it('should return data unchanged when configRefId does not match any frame', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'missing',
      mappings: [],
    };

    const results = extractConfigFromQuery(options, [config, seriesA]);
    expect(results).toEqual([config, seriesA]);
  });

  it('Select and apply with two frames and default mappings and reducer', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [],
    };

    const results = extractConfigFromQuery(options, [config, seriesA]);
    expect(results.length).toBe(1);
    expect(results[0].fields[1].config.max).toBe(50);
    expect(results[0].fields[1].config.min).toBe(5);
  });

  it('Can apply to config frame if there is only one frame', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [],
    };

    const results = extractConfigFromQuery(options, [config]);
    expect(results.length).toBe(1);
    expect(results[0].fields[1].name).toBe('Max');
    expect(results[0].fields[1].config.max).toBe(50);
  });

  it('With ignore mappings', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [{ fieldName: 'Min', handlerKey: FieldConfigHandlerKey.Ignore }],
    };

    const results = extractConfigFromQuery(options, [config, seriesA]);
    expect(results.length).toBe(1);
    expect(results[0].fields[1].config.min).toEqual(undefined);
    expect(results[0].fields[1].config.max).toEqual(50);
  });

  it('With custom mappings', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [{ fieldName: 'Min', handlerKey: 'decimals' }],
    };

    const results = extractConfigFromQuery(options, [config, seriesA]);
    expect(results.length).toBe(1);
    expect(results[0].fields[1].config.decimals).toBe(5);
  });

  it('With custom reducer', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [{ fieldName: 'Max', handlerKey: 'max', reducerId: ReducerID.min }],
    };

    const results = extractConfigFromQuery(options, [config, seriesA]);
    expect(results.length).toBe(1);
    expect(results[0].fields[1].config.max).toBe(1);
  });

  it('With threshold', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [{ fieldName: 'Max', handlerKey: 'threshold1', handlerArguments: { threshold: { color: 'orange' } } }],
    };

    const results = extractConfigFromQuery(options, [config, seriesA]);
    expect(results.length).toBe(1);
    const thresholdConfig = results[0].fields[1].config.thresholds?.steps[0];
    expect(thresholdConfig).toBeDefined();
    expect(thresholdConfig?.color).toBe('orange');
    expect(thresholdConfig?.value).toBe(50);
  });

  it('With custom matcher and displayName mapping', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [{ fieldName: 'Names', handlerKey: 'displayName', reducerId: ReducerID.first }],
      applyTo: { id: 'byName', options: 'Value' },
    };

    const results = extractConfigFromQuery(options, [config, seriesA]);
    expect(results.length).toBe(1);
    expect(results[0].fields[1].config.displayName).toBe('first-name');
  });
});

describe('preserves frame properties', () => {
  const config = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [1, 2] },
      { name: 'Max', type: FieldType.number, values: [1, 10, 50] },
      { name: 'Min', type: FieldType.number, values: [1, 10, 5] },
    ],
    refId: 'A',
  });

  it('should preserve frame name on output frames', () => {
    const seriesB = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'Value', type: FieldType.number, values: [2, 3, 4] },
      ],
    });
    seriesB.name = 'cpu-utilization';
    seriesB.refId = 'B';

    const seriesC = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'Value', type: FieldType.number, values: [5, 6, 7] },
      ],
    });
    seriesC.name = 'memory-usage';
    seriesC.refId = 'B';

    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [],
    };

    const results = extractConfigFromQuery(options, [config, seriesB, seriesC]);

    expect(results.length).toBe(2);
    expect(results[0].name).toBe('cpu-utilization');
    expect(results[1].name).toBe('memory-usage');
  });

  it('should preserve frame meta on output frames', () => {
    const seriesB = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'Value', type: FieldType.number, values: [2, 3, 4] },
      ],
    });
    seriesB.name = 'request-rate';
    seriesB.refId = 'B';
    seriesB.meta = { executedQueryString: 'SELECT rate FROM requests' };

    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [],
    };

    const results = extractConfigFromQuery(options, [config, seriesB]);

    expect(results.length).toBe(1);
    expect(results[0].name).toBe('request-rate');
    expect(results[0].meta?.executedQueryString).toBe('SELECT rate FROM requests');
  });
});

describe('transformer operator pipeline', () => {
  beforeAll(() => {
    mockTransformationsRegistry([getConfigFromDataTransformer()]);
  });

  it('should apply config via the operator', async () => {
    const config = toDataFrame({
      fields: [{ name: 'Max', type: FieldType.number, values: [200] }],
      refId: 'config',
    });

    const series = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'Value', type: FieldType.number, values: [10, 20, 30] },
      ],
    });
    series.name = 'throughput';
    series.refId = 'A';

    const cfg = {
      id: DataTransformerID.configFromData,
      options: {
        configRefId: 'config',
        mappings: [],
      },
    };

    await expect(transformDataFrame([cfg], [config, series])).toEmitValuesWith((received) => {
      const result = received[0];
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('throughput');
      expect(result[0].fields[1].config.max).toBe(200);
    });
  });
});

describe('value mapping from data', () => {
  const config = toDataFrame({
    fields: [
      { name: 'value', type: FieldType.number, values: [1, 2, 3] },
      { name: 'threshold', type: FieldType.number, values: [4] },
      { name: 'text', type: FieldType.string, values: ['one', 'two', 'three'] },
      { name: 'color', type: FieldType.string, values: ['red', 'blue', 'green'] },
    ],
    refId: 'config',
  });

  const seriesA = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
      {
        name: 'Value',
        type: FieldType.number,
        values: [1, 2, 3],
        config: {},
      },
    ],
  });

  it('Should take all field values and map to value mappings', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'config',
      mappings: [
        { fieldName: 'value', handlerKey: 'mappings.value' },
        { fieldName: 'color', handlerKey: 'mappings.color' },
        { fieldName: 'text', handlerKey: 'mappings.text' },
      ],
    };

    const results = extractConfigFromQuery(options, [config, seriesA]);
    expect(results[0].fields[1].config.mappings).toMatchInlineSnapshot(`
      [
        {
          "options": {
            "1": {
              "color": "red",
              "index": 0,
              "text": "one",
            },
            "2": {
              "color": "blue",
              "index": 1,
              "text": "two",
            },
            "3": {
              "color": "green",
              "index": 2,
              "text": "three",
            },
          },
          "type": "value",
        },
      ]
    `);
  });
});
