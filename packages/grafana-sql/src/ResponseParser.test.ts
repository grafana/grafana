import { DataFrameDTO, FieldType, MutableDataFrame } from '@grafana/data';

import { ResponseParser } from './ResponseParser';

describe('transformMetricFindResponse function', () => {
  it('should handle big arrays', () => {
    const responseParser = new ResponseParser();
    const stringValues = new Array(150_000).fill('a');
    const numberValues = new Array(150_000).fill(1);

    const frame: DataFrameDTO = {
      fields: [
        { name: 'name', type: FieldType.string, values: stringValues },
        { name: 'value', type: FieldType.number, values: numberValues },
      ],
    };

    const dataFrame = new MutableDataFrame(frame);
    const result = responseParser.transformMetricFindResponse(dataFrame);

    expect(result).toHaveLength(2);
  });
});
