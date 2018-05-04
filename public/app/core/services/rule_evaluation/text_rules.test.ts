import { wrap, contains, notContains, startsWith, endsWith, isExactly, getTextRules } from './text_rules';

describe('wrap', () => {
  it('should convert input and single parameter to strings', () => {
    const evaluate = wrap(1, (input: string, param: string) => {
      expect(input).toBe('str1');
      expect(param).toBe('str2');
    });
    evaluate('str1', ['str2']);
  });

  it('should convert input and parameters to strings and trim leading and trailing white space', () => {
    const evaluate = wrap(2, (input: string, paramOne: string, paramTwo: string) => {
      expect(input).toBe('str1');
      expect(paramOne).toBe('str2');
      expect(paramTwo).toBe('str3');
    });
    evaluate(' str1 ', [' str2 ', ' str3 ']);
  });

  it('should not convert number input to string', () => {
    const evaluate = wrap(1, () => {
      return true;
    });
    const res = evaluate(1, ['str2']);
    expect(res).toBeFalsy();
  });

  it('should not convert number parameter to string', () => {
    const evaluate = wrap(1, () => {
      return true;
    });
    const res = evaluate('str1', [2]);
    expect(res).toBeFalsy();
  });

  it('should not convert array input to strings', () => {
    const evaluate = wrap(1, () => {
      return true;
    });
    const res = evaluate(['str1'], ['str2']);
    expect(res).toBeFalsy();
  });

  it('should not convert array parameter to string', () => {
    const evaluate = wrap(1, () => {
      return true;
    });
    const res = evaluate('str1', [['str2']]);
    expect(res).toBeFalsy();
  });
});

describe('contains', () => {
  it('should return false when not containing cat', () => {
    const res = contains('The quick brown fox jumps over the lazy dog', 'cat');
    expect(res).toBeFalsy();
  });

  it('should return true when containing fox', () => {
    const res = contains('The quick brown fox jumps over the lazy dog', 'fox');
    expect(res).toBeTruthy();
  });

  ['/^the/', '/cat/'].forEach(regex =>
    it(`should return false when not matching regex ${regex}`, () => {
      const res = contains('The quick brown fox jumps over the lazy dog', regex);
      expect(res).toBeFalsy();
    })
  );

  ['/^.*$/', '/fox|dog/', '/^The/', '/dog$/'].forEach(regex =>
    it(`should return true when matching regex ${regex}`, () => {
      const res = contains('The quick brown fox jumps over the lazy dog', regex);
      expect(res).toBeTruthy();
    })
  );
});

describe('not contains', () => {
  it('should return true when not containing cat', () => {
    const res = notContains('The quick brown fox jumps over the lazy dog', 'cat');
    expect(res).toBeTruthy();
  });

  it('should return false when containing fox', () => {
    const res = notContains('The quick brown fox jumps over the lazy dog', 'fox');
    expect(res).toBeFalsy();
  });

  ['/^the/', '/cat/'].forEach(regex =>
    it(`should return true when not matching regex ${regex}`, () => {
      const res = notContains('The quick brown fox jumps over the lazy dog', regex);
      expect(res).toBeTruthy();
    })
  );

  ['/^.*$/', '/fox|dog/', '/^The/', '/dog$/'].forEach(regex =>
    it(`should return false when matching regex ${regex}`, () => {
      const res = notContains('The quick brown fox jumps over the lazy dog', regex);
      expect(res).toBeFalsy();
    })
  );
});

describe('starts with', () => {
  it('should return true when string starts with prefix', () => {
    const res = startsWith('The quick brown fox jumps over the lazy dog', 'The');
    expect(res).toBeTruthy();
  });

  it('should return false when not string starts with prefix', () => {
    const res = startsWith('The quick brown fox jumps over the lazy dog', 'quick');
    expect(res).toBeFalsy();
  });
});

describe('ends with', () => {
  it('should return true when string ends with postfix', () => {
    const res = endsWith('The quick brown fox jumps over the lazy dog', 'dog');
    expect(res).toBeTruthy();
  });

  it('should return false when not string ends with postfix', () => {
    const res = endsWith('The quick brown fox jumps over the lazy dog', 'lazy');
    expect(res).toBeFalsy();
  });
});

describe('is exactly', () => {
  it('should return false when "str1" = "str2"', () => {
    const res = isExactly('str1', 'str2');
    expect(res).toBeFalsy();
  });

  it('should return true when "str1" = "str1"', () => {
    const res = isExactly('str1', 'str1');
    expect(res).toBeTruthy();
  });
});

describe('getTextRules', () => {
  it('should return text rules', () => {
    const res = getTextRules();
    expect(res.length).toBeGreaterThan(0);
  });
});
