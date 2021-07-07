import { toDataFrame, FieldType } from '@grafana/data';
import { extractConfigFromData, ConfigFromDataTransformerOptions } from './configFromData';

describe('config from data', () => {
  // Waiting with this scenario as it seems straight forward, think will do this as separate transform
  //   it('Will extract min & max from field', () => {
  //     const input = toDataFrame({
  //       fields: [
  //         { name: 'Name', type: FieldType.time, values: ['Temperature', 'Pressure'] },
  //         { name: 'Value', type: FieldType.number, values: [10, 200] },
  //         { name: 'Unit', type: FieldType.string, values: ['degree', 'pressurebar'] },
  //         { name: 'Min', type: FieldType.number, values: [3, 100] },
  //         { name: 'Max', type: FieldType.string, values: [15, 200] },
  //       ],
  //     });

  //     const result = extractConfigFromData({}, [input])[0];
  //     expect(result.fields[0].name).toBe('Temperature');
  //     expect(result.fields[1].name).toBe('Pressure');
  //   });

  it('Select and apply with two frames', () => {
    const config = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1] },
        { name: 'Max', type: FieldType.string, values: [50] },
        { name: 'Min', type: FieldType.string, values: [5] },
      ],
    });

    const seriesA = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
        {
          name: 'Value',
          type: FieldType.string,
          values: [2, 3, 4],
          config: { displayName: 'SeriesA' },
        },
      ],
    });

    const options: ConfigFromDataTransformerOptions = {
      sources: [
        { fieldName: 'Max', reducerId: 'max', configProperty: 'max' },
        { fieldName: 'Min', reducerId: 'min', configProperty: 'min' },
      ],
      applyTo: { id: 'byName', options: 'Value' },
    };

    const results = extractConfigFromData(options, [config, seriesA]);

    expect(results.length).toBe(1);
    expect(results[0].fields[1].config.max).toBe(50);
    expect(results[0].fields[1].config.min).toBe(50);
  });
});
