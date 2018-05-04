import {
  wrap,
  equal,
  notEqual,
  lessThan,
  lessThanOrEqual,
  greaterThan,
  greaterThanOrEqual,
  withinRange,
  outsideRange,
  getNumericRules,
} from './numeric_rules';

describe('wrap', () => {
  it('should convert input and single parameter to numbers', () => {
    const evaluate = wrap(1, (input: number, param: number) => {
      expect(input).toBe(1);
      expect(param).toBe(2);
    });
    evaluate(1, [2]);
  });

  it('should convert input and parameters to numbers', () => {
    const evaluate = wrap(2, (input: number, paramOne: number, paramTwo: number) => {
      expect(input).toBe(1);
      expect(paramOne).toBe(2);
      expect(paramTwo).toBe(3);
    });
    evaluate(1, [2, 3]);
  });

  it('should not convert string input to numbers', () => {
    const evaluate = wrap(1, () => {
      return true;
    });
    const res = evaluate('1', [2]);
    expect(res).toBeFalsy();
  });

  it('should not convert string parameter to number', () => {
    const evaluate = wrap(1, () => {
      return true;
    });
    const res = evaluate(1, ['2']);
    expect(res).toBeFalsy();
  });

  it('should not convert array input to numbers', () => {
    const evaluate = wrap(1, () => {
      return true;
    });
    const res = evaluate([1], [2]);
    expect(res).toBeFalsy();
  });

  it('should not convert array parameter to number', () => {
    const evaluate = wrap(1, () => {
      return true;
    });
    const res = evaluate(1, [[2]]);
    expect(res).toBeFalsy();
  });
});

describe('equal', () => {
  it('should return false when 0 = 1', () => {
    const res = equal(0, 1);
    expect(res).toBeFalsy();
  });

  it('should return true when 1 = 1', () => {
    const res = equal(1, 1);
    expect(res).toBeTruthy();
  });
});

describe('not equal', () => {
  it('should return true when 0 != 1', () => {
    const res = notEqual(0, 1);
    expect(res).toBeTruthy();
  });

  it('should return false when 1 = 1', () => {
    const res = notEqual(1, 1);
    expect(res).toBeFalsy();
  });
});

describe('greater than', () => {
  it('should return true when 2 > 1', () => {
    const res = greaterThan(2, 1);
    expect(res).toBeTruthy();
  });

  it('should return false when 2 > 2', () => {
    const res = greaterThan(2, 2);
    expect(res).toBeFalsy();
  });

  it('should return false when 1 < 2', () => {
    const res = greaterThan(1, 2);
    expect(res).toBeFalsy();
  });
});

describe('greater than or equal', () => {
  it('should return true when 2 >= 1', () => {
    const res = greaterThanOrEqual(2, 1);
    expect(res).toBeTruthy();
  });

  it('should return true when 2 >= 2', () => {
    const res = greaterThanOrEqual(2, 2);
    expect(res).toBeTruthy();
  });

  it('should return false when 1 >= 2', () => {
    const res = greaterThanOrEqual(1, 2);
    expect(res).toBeFalsy();
  });
});

describe('less than', () => {
  it('should return true when 1 < 2', () => {
    const res = lessThan(1, 2);
    expect(res).toBeTruthy();
  });

  it('should return false when 2 < 2', () => {
    const res = lessThan(2, 2);
    expect(res).toBeFalsy();
  });

  it('should return false when 2 < 1', () => {
    const res = lessThan(2, 1);
    expect(res).toBeFalsy();
  });
});

describe('less than or equal', () => {
  it('should return true when 1 <= 2', () => {
    const res = lessThanOrEqual(1, 2);
    expect(res).toBeTruthy();
  });

  it('should return true when 2 <= 2', () => {
    const res = lessThanOrEqual(2, 2);
    expect(res).toBeTruthy();
  });

  it('should return false when 2 <= 1', () => {
    const res = lessThanOrEqual(2, 1);
    expect(res).toBeFalsy();
  });
});

describe('within range', () => {
  it('should return true when 2 >= 1 and 2 <= 3', () => {
    const res = withinRange(2, 1, 3);
    expect(res).toBeTruthy();
  });

  it('should return true when 2 >= 2 and 2 <= 3', () => {
    const res = withinRange(2, 2, 3);
    expect(res).toBeTruthy();
  });

  it('should return true when 3 >= 1 and 3 <= 3', () => {
    const res = withinRange(3, 2, 3);
    expect(res).toBeTruthy();
  });

  it('should return true when -5 >= -10 and -5 <= 10', () => {
    const res = withinRange(-5, -10, 10);
    expect(res).toBeTruthy();
  });

  it('should return false when 2 >= 3 and 2 <= 4', () => {
    const res = withinRange(2, 3, 4);
    expect(res).toBeFalsy();
  });

  it('should return false when 5 >= 3 and 5 <= 4', () => {
    const res = withinRange(5, 3, 4);
    expect(res).toBeFalsy();
  });
});

describe('outside range', () => {
  it('should return false when 2 < 1 or 2 > 3', () => {
    const res = outsideRange(2, 1, 3);
    expect(res).toBeFalsy();
  });

  it('should return false when 2 < 2 or 2 > 3', () => {
    const res = outsideRange(2, 2, 3);
    expect(res).toBeFalsy();
  });

  it('should return false when 3 < 2 or 3 > 3', () => {
    const res = outsideRange(3, 2, 3);
    expect(res).toBeFalsy();
  });

  it('should return false when -5 < -10 or -5 > 10', () => {
    const res = outsideRange(-5, -10, 10);
    expect(res).toBeFalsy();
  });

  it('should return true when 2 < 3 or 2 > 4', () => {
    const res = outsideRange(2, 3, 4);
    expect(res).toBeTruthy();
  });

  it('should return true when 5 < 3 or 5 > 4', () => {
    const res = outsideRange(5, 3, 4);
    expect(res).toBeTruthy();
  });
});

describe('getNumericRules', () => {
  it('should return numeric rules', () => {
    const res = getNumericRules();
    expect(res.length).toBeGreaterThan(0);
  });
});
