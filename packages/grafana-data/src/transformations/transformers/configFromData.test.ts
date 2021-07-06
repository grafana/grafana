import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { extractConfigFromData } from './configFromData';

describe('config from data', () => {
  it('Will extract min & max from field', () => {
    const input = toDataFrame({
      fields: [
        { name: 'Name', type: FieldType.time, values: ['Temperature', 'Pressure'] },
        { name: 'Value', type: FieldType.number, values: [10, 200] },
        { name: 'Unit', type: FieldType.string, values: ['degree', 'pressurebar'] },
        { name: 'Min', type: FieldType.number, values: [3, 100] },
        { name: 'Max', type: FieldType.string, values: [15, 200] },
      ],
    });

    const result = extractConfigFromData({}, [input])[0];
    expect(result.fields[0].name).toBe('Temperature');
    expect(result.fields[1].name).toBe('Pressure');
  });
});
