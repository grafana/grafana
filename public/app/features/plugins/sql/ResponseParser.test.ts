import { fill } from 'lodash';

import { DataFrameDTO, FieldType, MutableDataFrame } from '@grafana/data';

import { ResponseParser } from './ResponseParser';

describe('transformMetricFindResponse function', () => {
  it('should handle big arrays', () => {
    const responseParser = new ResponseParser();
    const stringValues = new Array(150000);
    const numberValues = new Array(150000);

    const frame: DataFrameDTO = {
      fields: [
        { name: 'name', type: FieldType.string, values: fill(stringValues, 'a') },
        { name: 'value', type: FieldType.number, values: fill(numberValues, 1) },
      ],
    };

    const dataFrame = new MutableDataFrame(frame);
    const result = responseParser.transformMetricFindResponse(dataFrame);

    expect(result).toHaveLength(2);
  });
});
