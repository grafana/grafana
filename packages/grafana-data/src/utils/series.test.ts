import { getSeriesTimeStep } from './series';
import { Field, FieldType } from '../types';
import { ArrayVector } from '../vector';

const uniformTimeField: Field = {
  name: 'time',
  type: FieldType.time,
  values: new ArrayVector([0, 100, 200, 300]),
  config: {},
};
const nonUniformTimeField: Field = {
  name: 'time',
  type: FieldType.time,
  values: new ArrayVector([0, 100, 300, 350]),
  config: {},
};

describe('getSeriesTimeStep', () => {
  test('uniform series', () => {
    const result = getSeriesTimeStep(uniformTimeField);
    expect(result).toBe(100);
  });

  test('non-uniform series', () => {
    const result = getSeriesTimeStep(nonUniformTimeField);
    expect(result).toBe(50);
  });
});
