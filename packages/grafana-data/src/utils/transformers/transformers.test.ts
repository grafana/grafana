import { DataTransformerID } from './ids';
import { dataTransformers } from './transformers';
import { toDataFrame } from '../processDataFrame';
import { ReducerID } from '../fieldReducer';
import { DataFrameView } from '../dataFrameView';

describe('Transformers', () => {
  it('should load all transformeres', () => {
    for (const name of Object.keys(DataTransformerID)) {
      const calc = dataTransformers.get(name);
      expect(calc.id).toBe(name);
    }
  });

  const seriesWithValues = toDataFrame({
    fields: [
      { name: 'A', values: [1, 2, 3, 4] }, // Numbers
      { name: 'B', values: ['a', 'b', 'c', 'd'] }, // Strings
    ],
  });

  it('should use fluent API', () => {
    const results = dataTransformers.reduce([seriesWithValues], {
      reducers: [ReducerID.first],
    });
    expect(results.length).toBe(1);

    const view = new DataFrameView(results[0]).toJSON();
    expect(view).toEqual([
      { Field: 'A', first: 1 }, // Row 0
      { Field: 'B', first: 'a' }, // Row 1
    ]);
  });
});
