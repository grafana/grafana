import validators from './validators';

describe('validatePort test', () => {
  it('return error string when value is 0', () => {
    expect(validators.validatePort(0)).toEqual('Port should be a number and between 0 and 65535');
  });

  it('return empty string when value in the middle of range', () => {
    expect(validators.validatePort(30000)).toEqual(undefined);
  });

  it('return correct error message when value is not in range', () => {
    const errorMessage = 'Port should be a number and between 0 and 65535';

    expect(validators.validatePort(65536)).toEqual(errorMessage);
  });

  it('return correct error message when value is invalid', () => {
    const errorMessage = 'Port should be a number and between 0 and 65535';

    expect(validators.validatePort('portnumber')).toEqual(errorMessage);
  });
});

describe('validateKeyValue test', () => {
  const errorMessage = 'Values have to be in key:value format, and separated with new line or space';

  it('return empty string when key:value is separated by whitespace', () => {
    const testString = 'key:value key2:value2';

    expect(validators.validateKeyValue(testString)).toEqual(undefined);
  });

  it('return empty string when key:value is separated by new line symbol', () => {
    const testString = 'key:value\nkey2:value2';

    expect(validators.validateKeyValue(testString)).toEqual(undefined);
  });

  it('returns empty string if value containts dash', () => {
    const testString = 'key:value-';

    expect(validators.validateKeyValue(testString)).toEqual(undefined);
  });

  it('returns empty string if key starts with a dash', () => {
    const testString = '_key:value';

    expect(validators.validateKeyValue(testString)).toEqual(undefined);
  });

  it('returns correct error message when key contains dash', () => {
    const testString = 'key-:value';

    expect(validators.validateKeyValue(testString)).toEqual(errorMessage);
  });

  it('returns correct error message when key starts with two underscores', () => {
    const testString = '__key:value';

    expect(validators.validateKeyValue(testString)).toEqual(errorMessage);
  });

  it('returns correct error message when key starts with two underscores', () => {
    const testString = '__key:value';

    expect(validators.validateKeyValue(testString)).toEqual(errorMessage);
  });

  it('returns correct error message when key starts with number', () => {
    const testString = '0key:value';

    expect(validators.validateKeyValue(testString)).toEqual(errorMessage);
  });

  it('returns correct error message when key contains non ASCII character', () => {
    const testString = 'keý:value';

    expect(validators.validateKeyValue(testString)).toEqual(errorMessage);
  });

  it('return correct error message when value is invalid', () => {
    const testString = 'key:value-key2:value2';

    expect(validators.validateKeyValue(testString)).toEqual(errorMessage);
  });
});

describe('Validate field is true', () => {
  it('should return undefined if the passed value is true', () => {
    expect(validators.requiredTrue(true)).toBeUndefined();
  });

  it('should return an error if the passed value is not true', () => {
    expect(validators.requiredTrue(false)).toEqual('Required field');
  });
});

describe('Validate email', () => {
  // NOTE (nicolalamacchia): some of these tests were taken from Chromium's source code
  test('email validator should return undefined if the passed email is valid', () => {
    expect(validators.validateEmail('test@example.org')).toBeUndefined();
    expect(validators.validateEmail('someone@127.0.0.1')).toBeUndefined();
    expect(validators.validateEmail("!#$%&'*+/=?^_`{|}~.-@com.com")).toBeUndefined();
    expect(validators.validateEmail('te..st@example.com')).toBeUndefined();
  });

  test('email validator should return an error string if the passed email is invalid', () => {
    expect(validators.validateEmail('test')).toEqual('Invalid email address');
    expect(validators.validateEmail('test@example')).toEqual('Invalid email address');
    expect(validators.validateEmail('invalid:email@example.com')).toEqual('Invalid email address');
    expect(validators.validateEmail('someone@somewhere.com.')).toEqual('Invalid email address');
    expect(validators.validateEmail('""test\blah""@example.com')).toEqual('Invalid email address');
    expect(validators.validateEmail('a\u3000@p.com')).toEqual('Invalid email address');
    expect(validators.validateEmail('ddjk-s-jk@asl-.com')).toEqual('Invalid email address');
    expect(validators.validateEmail('a @p.com')).toEqual('Invalid email address');
    expect(validators.validateEmail('')).toEqual('Invalid email address');
  });
});

describe('Validate range test', () => {
  it('return undefined when value on lower border', () => {
    const rangeValidator = validators.range(0, 100);

    expect(rangeValidator(0)).toEqual(undefined);
  });

  it('return undefined when value on upper border', () => {
    const rangeValidator = validators.range(0, 100);

    expect(rangeValidator(100)).toEqual(undefined);
  });

  it('return undefined when value in the middle of range', () => {
    const rangeValidator = validators.range(0, 100);

    expect(rangeValidator(50)).toEqual(undefined);
  });

  it('return error message when value not in range', () => {
    const from = 0;
    const to = 100;
    const errorMessage = `Value should be in the range from ${from} to ${to}`;
    const rangeValidator = validators.range(from, to);

    expect(rangeValidator(110)).toEqual(errorMessage);
  });
});

describe('Validate min test', () => {
  it('return undefined when is equal to min', () => {
    const minValidator = validators.min(3);

    expect(minValidator(3)).toEqual(undefined);
  });

  it('return undefined when value is greater than min', () => {
    const minValidator = validators.min(100);

    expect(minValidator(100)).toEqual(undefined);
  });

  it('return error message when value is less than min', () => {
    const from = 3;
    const errorMessage = `Value should be greater or equal to ${from}`;
    const minValidator = validators.min(from);

    expect(minValidator(2)).toEqual(errorMessage);
  });

  it('return error message when value is zero and min is greater', () => {
    const from = 3;
    const errorMessage = `Value should be greater or equal to ${from}`;
    const minValidator = validators.min(from);

    expect(minValidator(0)).toEqual(errorMessage);
  });
});

describe('Validate containCases', () => {
  it('Validator should return undefined if the passed value is valid', () => {
    expect(validators.containBothCases('Test')).toBeUndefined();
  });

  it('Validator should return undefined if the passed value is invalid', () => {
    expect(validators.containBothCases('test')).toEqual('Must include upper and lower cases');
    expect(validators.containBothCases('TEST')).toEqual('Must include upper and lower cases');
    expect(validators.containBothCases('111')).toEqual('Must include upper and lower cases');
  });
});

describe('Validate containNumbers', () => {
  it('Validator should return undefined if the passed value is valid', () => {
    expect(validators.containNumbers('1')).toBeUndefined();
    expect(validators.containNumbers('Test1')).toBeUndefined();
  });

  it('Validator should return undefined if the passed value is invalid', () => {
    expect(validators.containNumbers('test')).toEqual('Must include numbers');
    expect(validators.containNumbers('')).toEqual('Must include numbers');
  });
});

describe('Validate max length', () => {
  it('returns an error if the length of the input to be validated is greater than the specified max', () => {
    const testedLength = 8;

    expect(validators.maxLength(testedLength)('abcdefghijklmno')).toEqual(
      `Must contain at most ${testedLength} characters`
    );
    expect(validators.maxLength(testedLength)('123456789')).toEqual(`Must contain at most ${testedLength} characters`);
    expect(validators.maxLength(testedLength)('abcde1234')).toEqual(`Must contain at most ${testedLength} characters`);
  });

  it('returns undefined if the length of the input to be validated is less than or equal to the specified max', () => {
    const testedLength = 8;

    expect(validators.maxLength(testedLength)('')).toBeUndefined();
    expect(validators.maxLength(testedLength)('a')).toBeUndefined();
    expect(validators.maxLength(testedLength)('a1')).toBeUndefined();
    expect(validators.maxLength(testedLength)('1')).toBeUndefined();
    expect(validators.maxLength(testedLength)('12345678')).toBeUndefined();
  });
});

describe('Validate min length', () => {
  it('Validator should return undefined if the passed value is valid', () => {
    const testedLength = 8;

    expect(validators.minLength(testedLength)('12345678')).toBeUndefined();
    expect(validators.minLength(testedLength)('123456789')).toBeUndefined();
  });

  it('Validator should return undefined if the passed value is invalid', () => {
    const testedLength = 8;

    expect(validators.minLength(testedLength)('1234567')).toEqual(`Must contain at least ${testedLength} characters`);
    expect(validators.minLength(testedLength)('0')).toEqual(`Must contain at least ${testedLength} characters`);
  });
});

describe('validators compose', () => {
  it('return correct validation error when value is undefined', () => {
    const rangeValidator = validators.range(0, 100);
    const validate = validators.compose(rangeValidator, validators.required);

    expect(validate(undefined, {})).toEqual('Required field');
  });

  it('return correct validation error when value is in the middle of range', () => {
    const from = 0;
    const to = 100;
    const errorMessage = `Value should be in the range from ${from} to ${to}`;
    const rangeValidator = validators.range(from, to);
    const validate = validators.compose(rangeValidator, validators.required);

    expect(validate(120, {})).toEqual(errorMessage);
  });
});
