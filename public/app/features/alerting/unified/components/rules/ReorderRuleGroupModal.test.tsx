import { reorder } from './ReorderRuleGroupModal';

describe('test reorder', () => {
  it('should reorder arrays', () => {
    const original = [1, 2, 3];
    const expected = [1, 3, 2];

    expect(reorder(original, 1, 2)).toEqual(expected);
    expect(original).not.toEqual(expected); // make sure we've not mutated the original
  });
});
