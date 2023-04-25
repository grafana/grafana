import { minLength } from './minLength';

describe('Validator minLength::', () => {
  it('should return undefined if the string length is equal to or greater than required', () => {
    const validator = minLength(8);

    expect(validator('12345678')).toBeUndefined();
    expect(validator('0123xYz456W')).toBeUndefined();
  });

  it('should return an error if the string length is less than required', () => {
    const length = 8;
    const validator = minLength(length);
    const errorMessage = `Must contain at least ${length} characters`;

    expect(validator('1234567')).toEqual(errorMessage);
    expect(validator('0')).toEqual(errorMessage);
    expect(validator(null)).toEqual(errorMessage);
  });
});
