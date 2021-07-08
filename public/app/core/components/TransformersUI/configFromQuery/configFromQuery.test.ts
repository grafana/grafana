import { toDataFrame, FieldType, ReducerID } from '@grafana/data';
import { extractConfigFromQuery, ConfigFromQueryTransformOptions } from './configFromQuery';

describe('config from data', () => {
  const config = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [1, 2] },
      { name: 'Max', type: FieldType.string, values: [1, 10, 50] },
      { name: 'Min', type: FieldType.string, values: [1, 10, 5] },
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

  it('With custom mappings', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [{ fieldName: 'Min', configProperty: 'decimals' }],
    };

    const results = extractConfigFromQuery(options, [config, seriesA]);
    expect(results.length).toBe(1);
    expect(results[0].fields[1].config.decimals).toBe(5);
  });

  it('With custom reducer', () => {
    const options: ConfigFromQueryTransformOptions = {
      configRefId: 'A',
      mappings: [{ fieldName: 'Max', configProperty: 'max', reducerId: ReducerID.min }],
    };

    const results = extractConfigFromQuery(options, [config, seriesA]);
    expect(results.length).toBe(1);
    expect(results[0].fields[1].config.max).toBe(1);
  });
});
