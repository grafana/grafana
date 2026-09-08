import { escapeStringForRegex, stringToJsRegex, stringToMs, unEscapeStringFromRegex } from './string';

describe('stringToJsRegex', () => {
  it('anchors a plain string so it only matches the whole value', () => {
    const output = stringToJsRegex('validRegexp');

    expect(output).toEqual(/^validRegexp$/);
    expect(output.test('validRegexp')).toBe(true);
    expect(output.test('xvalidRegexpx')).toBe(false);
  });

  it('unwraps a /…/ literal, leaving the pattern unanchored', () => {
    const output = stringToJsRegex('/validRegexp/');

    expect(output).toEqual(/validRegexp/);
    expect(output.test('xvalidRegexpx')).toBe(true);
  });

  it.each([
    ['/abc/g', /abc/g],
    ['/abc/gi', /abc/gi],
    ['/a.b/s', /a.b/s],
    // gimys is the only order the matcher accepts; flags are reported (and formatted) alphabetically
    ['/abc/gimys', /abc/gimsy],
    ['/a/b/', /a\/b/],
  ])('parses %p into %p', (input, expected) => {
    expect(stringToJsRegex(input)).toEqual(expected);
  });

  it('rejects supported flags that are not written in gimys order', () => {
    expect(() => stringToJsRegex('/abc/ig')).toThrow("'/abc/ig' is not a valid regular expression.");
    expect(() => stringToJsRegex('/abc/sg')).toThrow("'/abc/sg' is not a valid regular expression.");
  });

  it.each([
    ['/etc/hostname', "'/etc/hostname' is not a valid regular expression."],
    ['/abc/x', "'/abc/x' is not a valid regular expression."],
  ])('throws on %p, which the /pattern/flags matcher does not accept', (input, message) => {
    expect(() => stringToJsRegex(input)).toThrow(message);
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
    ['[[[', '\\[\\[\\['],
    ['[]\\', '\\[\\]\\\\'],
    ['[(abc])', '\\[\\(abc\\]\\)'],
    ['onetwothree', 'onetwothree'],
    ['some string 123', 'some string 123'],
    ['<namedgroup}(this is not a regex>', '\\<namedgroup\\}\\(this is not a regex\\>'],
    ['string\\with\\backslash', 'string\\\\with\\\\backslash'],
    ['everyspecialchar([{])}.,/?&*-^&<>#', 'everyspecialchar\\(\\[\\{\\]\\)\\}\\.,/\\?\\&\\*\\-\\^\\&\\<\\>\\#'],
  ])('escapes %p to %p, which then matches the input literally', (input, escaped) => {
    expect(escapeStringForRegex(input)).toBe(escaped);
    expect(new RegExp(escaped).exec(input)?.[0]).toBe(input);
  });

  it('escapes a wildcard so it stops matching any character', () => {
    const pattern = new RegExp(escapeStringForRegex('a.c'));

    expect(pattern.test('a.c')).toBe(true);
    expect(pattern.test('abc')).toBe(false);
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
