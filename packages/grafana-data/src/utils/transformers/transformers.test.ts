import { DataTransformerID } from './ids';
import { dataTransformers } from './transformers';

describe('Transformers', () => {
  it('should load all transformeres', () => {
    for (const name of Object.keys(DataTransformerID)) {
      const calc = dataTransformers.get(name);
      expect(calc.id).toBe(name);
    }
  });
});
