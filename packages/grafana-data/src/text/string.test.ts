import {
  escapeRegex,
  escapeStringForRegex,
  stringStartsAsRegEx,
  stringToJsRegex,
  stringToMs,
  toFloatOrUndefined,
  toIntegerOrUndefined,
  toNumberString,
  toPascalCase,
  unEscapeStringFromRegex,
} from './string';

describe('stringToJsRegex', () => {
  it('should just return string as RegEx if it does not start as a regex', () => {
    const output = stringToJsRegex('validRegexp');
    expect(output).toBeInstanceOf(RegExp);
  });

  it('should parse the valid regex value', () => {
    const output = stringToJsRegex('/validRegexp/');
    expect(output).toBeInstanceOf(RegExp);
  });

  it('should throw error on invalid regex value', () => {
    const input = '/etc/hostname';
    expect(() => {
      stringToJsRegex(input);
    }).toThrow();
  });
});

describe('stringToMs', () => {
  it('should return zero if no input', () => {
    const output = stringToMs('');
    expect(output).toBe(0);
  });

  it('should return its input, as int, if no unit is supplied', () => {
    const output = stringToMs('1000');
    expect(output).toBe(1000);
  });

  it('should convert 3s to 3000', () => {
    const output = stringToMs('3s');
    expect(output).toBe(3000);
  });

  it('should convert 2m to 120000', () => {
    const output = stringToMs('2m');
    expect(output).toBe(120000);
  });

  it('should convert 2h to 7200000', () => {
    const output = stringToMs('2h');
    expect(output).toBe(7200000);
  });

  it('should convert 2d to 172800000', () => {
    const output = stringToMs('2d');
    expect(output).toBe(172800000);
  });

  it('should throw on unsupported unit', () => {
    expect(() => {
      stringToMs('1y');
    }).toThrow();
  });
});

describe('[un]escapeStringForRegex', () => {
  it.each([
    '[]',
    '\\',
    '[(abc])',
    'onetwothree',
    '<namedgroup}(this is not a regex>',
    'string\\with\\backslash',
    'everyspecialchar([{])}.,/?&*-^&<>#',
  ])('should be symmetric', (input) => {
    const output = unEscapeStringFromRegex(escapeStringForRegex(input));
    expect(output).toEqual(input);
  });
});

describe('escapeStringForRegex', () => {
  it.each([
    '[[[',
    '[]\\',
    '[(abc])',
    'onetwothree',
    '<namedgroup}(this is not a regex>',
    'string\\with\\backslash',
    'everyspecialchar([{])}.,/?&*-^&<>#',
  ])('should always produce output that compiles', (value) => {
    expect(() => new RegExp(escapeStringForRegex(value))).not.toThrowError();
  });

  describe('when using a string without special chars', () => {
    it('then nothing should change', () => {
      const result = escapeStringForRegex('some string 123');
      expect(result).toBe('some string 123');
    });
  });
});

describe('unEscapeStringFromRegex', () => {
  describe('when using a string with escaped special chars', () => {
    it('then all special chars should be unescaped', () => {
      const result = unEscapeStringFromRegex('\\(\\[\\{\\}\\]\\)\\|\\*\\+\\-\\.\\?\\<\\>\\#\\&\\^\\$');
      expect(result).toBe('([{}])|*+-.?<>#&^$');
    });
  });

  describe('when using a string without escaped special chars', () => {
    it('then nothing should change', () => {
      const result = unEscapeStringFromRegex('some string 123');
      expect(result).toBe('some string 123');
    });
  });
});

describe('stringStartsAsRegEx()', () => {
  it('returns true for strings starting with /', () => {
    expect(stringStartsAsRegEx('/foo/')).toBe(true);
  });

  it('returns false for strings not starting with /', () => {
    expect(stringStartsAsRegEx('foo')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(stringStartsAsRegEx('')).toBe(false);
  });
});

describe('toNumberString()', () => {
  it('converts a number to string', () => {
    expect(toNumberString(42)).toBe('42');
  });

  it('returns empty string for null', () => {
    expect(toNumberString(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(toNumberString(undefined)).toBe('');
  });

  it('returns empty string for Infinity', () => {
    expect(toNumberString(Infinity)).toBe('');
  });
});

describe('toIntegerOrUndefined()', () => {
  it('parses integer string', () => {
    expect(toIntegerOrUndefined('42')).toBe(42);
  });

  it('truncates float string to integer', () => {
    expect(toIntegerOrUndefined('3.7')).toBe(3);
  });

  it('returns undefined for non-numeric string', () => {
    expect(toIntegerOrUndefined('abc')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(toIntegerOrUndefined('')).toBeUndefined();
  });
});

describe('toFloatOrUndefined()', () => {
  it('parses float string', () => {
    expect(toFloatOrUndefined('3.14')).toBe(3.14);
  });

  it('returns undefined for non-numeric string', () => {
    expect(toFloatOrUndefined('abc')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(toFloatOrUndefined('')).toBeUndefined();
  });
});

describe('toPascalCase()', () => {
  it('converts space-separated words', () => {
    expect(toPascalCase('hello world')).toBe('HelloWorld');
  });

  it('converts hyphen-separated words', () => {
    expect(toPascalCase('foo-bar')).toBe('FooBar');
  });

  it('capitalizes a single word', () => {
    expect(toPascalCase('already')).toBe('Already');
  });
});

describe('escapeRegex()', () => {
  it('escapes dots', () => {
    expect(escapeRegex('hello.world')).toBe('hello\\.world');
  });

  it('escapes square brackets', () => {
    expect(escapeRegex('foo[bar]')).toBe('foo\\[bar\\]');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeRegex('helloworld')).toBe('helloworld');
  });
});
