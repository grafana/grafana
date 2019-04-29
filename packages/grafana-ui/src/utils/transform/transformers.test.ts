import { SeriesTransformerID } from './ids';
import { seriesTransformers } from './transformers';

describe('Transformers', () => {
  it('should load all transformeres', () => {
    for (const name of Object.keys(SeriesTransformerID)) {
      const calc = seriesTransformers.get(name);
      expect(calc.id).toBe(name);
    }
  });
});
