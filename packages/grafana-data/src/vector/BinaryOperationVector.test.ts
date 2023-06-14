import { binaryOperators, BinaryOperationID } from '../utils/binaryOperators';

import { ArrayVector } from './ArrayVector';
import { BinaryOperationVector } from './BinaryOperationVector';
import { ConstantVector } from './ConstantVector';

describe('ScaledVector', () => {
  it('should support multiply operations', () => {
    const source = new ArrayVector([1, 2, 3, 4]);
    const scale = 2.456;
    const operation = binaryOperators.get(BinaryOperationID.Multiply).operation;
    const v = new BinaryOperationVector(source, new ConstantVector(scale, source.length), operation);
    expect(v.length).toEqual(source.length);
    // Accessed with getters
    for (let i = 0; i < 4; i++) {
      expect(v.get(i)).toEqual(source.get(i) * scale);
    }
    // Accessed with array index
    for (let i = 0; i < 4; i++) {
      expect(v[i]).toEqual(source[i] * scale);
    }
  });
});
