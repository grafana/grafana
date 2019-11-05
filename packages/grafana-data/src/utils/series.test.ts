import { getSeriesTimeStep, hasMsResolution } from './series';
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

const msResolutionTimeField: Field = {
  name: 'time',
  type: FieldType.time,
  values: new ArrayVector([0, 1572951685007, 300, 350]),
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

describe('hasMsResolution', () => {
  test('return false if none of the timestamps is in ms', () => {
    const result = hasMsResolution(uniformTimeField);
    expect(result).toBeFalsy();
  });

  test('return true if any of the timestamps is in ms', () => {
    const result = hasMsResolution(msResolutionTimeField);
    expect(result).toBeTruthy();
  });
});
