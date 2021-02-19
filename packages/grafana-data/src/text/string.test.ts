import { escapeStringForRegex, stringToJsRegex, stringToMs, unEscapeStringFromRegex } from './string';

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

describe('escapeStringForRegex', () => {
  describe('when using a string with special chars', () => {
    it('then all special chars should be escaped', () => {
      const result = escapeStringForRegex('([{}])|*+-.?<>#&^$');
      expect(result).toBe('\\(\\[\\{\\}\\]\\)\\|\\*\\+\\-\\.\\?\\<\\>\\#\\&\\^\\$');
    });
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
