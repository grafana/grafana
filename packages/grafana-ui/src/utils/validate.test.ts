import { regexValidation, validate } from './validate';

describe('validate', () => {
  it('passes value to the rule', () => {
    expect.assertions(1);
    validate('some string', [
      {
        rule: (value: string) => {
          expect(value).toBe('some string');
          return true;
        },
        errorMessage: '',
      },
    ]);
  });

  it('runs multiple validation rules that return true', () => {
    expect(validate('some string', [pass(), pass(), pass()])).toEqual(null);
  });

  it('returns error message if one rule fails', () => {
    expect(validate('some string', [pass(), fail('error'), pass()])).toEqual(['error']);
  });

  it('returns all error messages', () => {
    expect(validate('some string', [fail('error1'), fail('error2'), fail('error3')])).toEqual([
      'error1',
      'error2',
      'error3',
    ]);
  });
});

describe('regexValidation', () => {
  it('runs regex on a value', () => {
    expect(validate('some value', [regexValidation(/some\svalu./)])).toBe(null);
  });

  it('runs fail if regex does not match', () => {
    expect(validate('some value', [regexValidation(/some\svalu\d/, 'regex failed')])).toEqual(['regex failed']);
  });
});

const pass = () => {
  return {
    rule: () => true,
    errorMessage: 'Should not happen',
  };
};

const fail = (message: string) => {
  return {
    rule: () => false,
    errorMessage: message,
  };
};
