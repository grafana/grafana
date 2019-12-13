import { ReducerID } from '../fieldReducer';
import { DataTransformerID } from './ids';
import { toDataFrame, toDataFrameDTO } from '../../dataframe/processDataFrame';
import { transformDataFrame } from '../transformers';

const seriesWithValues = toDataFrame({
  fields: [
    { name: 'A', values: [1, 2, 3, 4] }, // Numbers
    { name: 'B', values: ['a', 'b', 'c', 'd'] }, // Strings
  ],
});

describe('Reducer Transformer', () => {
  it('filters by include', () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.first, ReducerID.min, ReducerID.max, ReducerID.delta],
      },
    };
    const processed = transformDataFrame([cfg], [seriesWithValues])[0];
    expect(processed.fields.length).toBe(5);
    expect(toDataFrameDTO(processed)).toMatchSnapshot();
  });
});
