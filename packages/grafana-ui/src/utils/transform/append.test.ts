import { transformSeriesData, seriesTransformers } from './transformers';
import { SeriesTransformerID } from './ids';

const seriesAB = {
  fields: [{ name: 'A' }, { name: 'B' }],
  rows: [
    [1, 2], // A,B
    [1, 2], // A,B
  ],
};

const seriesBC = {
  fields: [{ name: 'B' }, { name: 'C' }],
  rows: [
    [2, 3], // A,B
    [2, 3], // A,B
  ],
};

describe('Append Transformer', () => {
  it('filters by include', () => {
    const cfg = {
      id: SeriesTransformerID.append,
      options: {},
    };
    const x = seriesTransformers.get(SeriesTransformerID.append);
    expect(x.id).toBe(cfg.id);

    const filtered = transformSeriesData([cfg], [seriesAB, seriesBC])[0];
    expect(filtered.fields.length).toBe(3);
    expect(filtered).toMatchSnapshot();
  });
});
