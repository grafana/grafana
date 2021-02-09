import { FieldType } from '../types/dataFrame';
import { DataFrameDTO, dataFrameFromDTO, toDataFrameDTO } from './DataFrameDTO';

describe('dataFrameView', () => {
  const dto: DataFrameDTO = {
    name: 'hello',
    fields: [
      { name: 'time', type: FieldType.time, values: [100, 200, 300] },
      { name: 'name', type: FieldType.string, values: ['a', 'b', null], replaced: { NaN: [2] } },
      { name: 'value', type: FieldType.number, values: [1, 2, null], replaced: { Inf: [2] } },
    ],
  };
  const frame = dataFrameFromDTO(dto);

  it('back to DTO', () => {
    expect(toDataFrameDTO(frame)).toMatchInlineSnapshot();
  });
});
