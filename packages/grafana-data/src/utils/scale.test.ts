import { Scale, ScaleMode } from '../types';
import { sortThresholds } from './scale';

describe('scale', () => {
  test('sort thresholds', () => {
    const scale: Scale = {
      steps: [
        { color: 'RED', value: 10 },
        { color: 'RED', value: 100 },
        { color: 'RED', value: 1 },
      ],
      mode: ScaleMode.absolute,
    };
    const sorted = sortThresholds(scale.steps).map(t => t.value);
    expect(sorted).toEqual([1, 10, 100]);
  });
});
