import RuleEvaluator from './rule_evaluator';

const re = new RuleEvaluator('');

describe('getRuleTypes', () => {
  it('should return rule types', () => {
    const res = re.getRuleTypes();
    expect(res.length).toBeGreaterThan(0);
  });
});

describe('evaluateRule', () => {
  it('should return false for non-existing rule', () => {
    const res = re.evaluateRule('non-existing', null, null);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating eq rule (1 = 1)', () => {
    const res = re.evaluateRule('eq', 1, [1]);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating eq rule (1 = 2)', () => {
    const res = re.evaluateRule('eq', 1, [2]);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating neq rule (1 != 2)', () => {
    const res = re.evaluateRule('neq', 1, [2]);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating neq rule (1 != 1)', () => {
    const res = re.evaluateRule('neq', 1, [1]);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating lt rule (1 < 2)', () => {
    const res = re.evaluateRule('lt', 1, [2]);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating lt rule (3 < 2)', () => {
    const res = re.evaluateRule('lt', 3, [2]);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating lte rule (2 <= 2)', () => {
    const res = re.evaluateRule('lte', 2, [2]);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating lte rule (3 <= 2)', () => {
    const res = re.evaluateRule('lte', 3, [2]);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating gt rule (2 > 1)', () => {
    const res = re.evaluateRule('gt', 2, [1]);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating gt rule (2 > 3)', () => {
    const res = re.evaluateRule('gt', 2, [3]);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating gte rule (2 >= 2)', () => {
    const res = re.evaluateRule('gte', 2, [2]);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating gte rule (2 >= 3)', () => {
    const res = re.evaluateRule('gte', 2, [3]);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating within_range rule (2 >= 1 and 2 <= 3)', () => {
    const res = re.evaluateRule('within_range', 2, [1, 3]);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating within_range rule (4 >= 1 and 4 <= 3)', () => {
    const res = re.evaluateRule('within_range', 4, [1, 3]);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating outside_range rule (4 < 1 or 4 > 3)', () => {
    const res = re.evaluateRule('outside_range', 4, [1, 3]);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating outside_range rule (2 < 1 or 2 > 3)', () => {
    const res = re.evaluateRule('outside_range', 2, [1, 3]);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating contains rule', () => {
    const res = re.evaluateRule('contains', 'The quick brown fox jumps over the lazy dog', ['dog']);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating contain rule', () => {
    const res = re.evaluateRule('contains', 'The quick brown fox jumps over the lazy dog', ['turtle']);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating not_contains rule', () => {
    const res = re.evaluateRule('not_contains', 'The quick brown fox jumps over the lazy dog', ['turtle']);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating not_contains rule', () => {
    const res = re.evaluateRule('not_contains', 'The quick brown fox jumps over the lazy dog', ['fox']);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating starts_with rule', () => {
    const res = re.evaluateRule('starts_with', 'The quick brown fox jumps over the lazy dog', ['The']);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating starts_with rule', () => {
    const res = re.evaluateRule('starts_with', 'The quick brown fox jumps over the lazy dog', ['dog']);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating ends_with rule', () => {
    const res = re.evaluateRule('ends_with', 'The quick brown fox jumps over the lazy dog', ['dog']);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating ends_with rule', () => {
    const res = re.evaluateRule('ends_with', 'The quick brown fox jumps over the lazy dog', ['The']);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating is_exactly rule', () => {
    const res = re.evaluateRule('is_exactly', 'The quick brown fox jumps over the lazy dog', [
      'The quick brown fox jumps over the lazy dog',
    ]);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating is_exactly rule', () => {
    const res = re.evaluateRule('is_exactly', 'The quick brown fox jumps over the lazy dog', [
      'The quick brown fox jumped over the lazy dog',
    ]);
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating is_empty rule', () => {
    const res = re.evaluateRule('is_empty', null);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating is_empty rule', () => {
    const res = re.evaluateRule('is_empty', 'str');
    expect(res).toBeFalsy();
  });

  it('should return true when evaluating is_not_empty rule', () => {
    const res = re.evaluateRule('is_not_empty', 1);
    expect(res).toBeTruthy();
  });

  it('should return false when evaluating is_not_empty rule', () => {
    const res = re.evaluateRule('is_not_empty', undefined);
    expect(res).toBeFalsy();
  });
});
