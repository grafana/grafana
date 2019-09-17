import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { transformDataFrame } from '../transformers';
import { transformersRegistry } from '../transformers';

const seriesAB = toDataFrame({
  columns: [{ text: 'A' }, { text: 'B' }],
  rows: [
    [1, 100], // A,B
    [2, 200], // A,B
  ],
});

const seriesBC = toDataFrame({
  columns: [{ text: 'A' }, { text: 'C' }],
  rows: [
    [3, 3000], // A,C
    [4, 4000], // A,C
  ],
});

describe('Append Transformer', () => {
  it('filters by include', () => {
    const cfg = {
      id: DataTransformerID.append,
      options: {},
    };
    const x = transformersRegistry.get(DataTransformerID.append);
    expect(x.id).toBe(cfg.id);

    const processed = transformDataFrame([cfg], [seriesAB, seriesBC])[0];
    expect(processed.fields.length).toBe(3);

    const fieldA = processed.fields[0];
    const fieldB = processed.fields[1];
    const fieldC = processed.fields[2];

    expect(fieldA.values.toArray()).toEqual([1, 2, 3, 4]);
    expect(fieldB.values.toArray()).toEqual([100, 200, null, null]);
    expect(fieldC.values.toArray()).toEqual([null, null, 3000, 4000]);
  });
});
