/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { containsUppercase } from './containsUppercase';

describe('Validators:: containsUppercase', () => {
  const errorMessage = 'Must include at least one uppercase letter';

  it('should return undefined if the input contains at least one uppercase character', () => {
    expect(containsUppercase('Test')).toEqual(undefined);
    expect(containsUppercase('TEST')).toEqual(undefined);
    expect(containsUppercase('QQQQQQ')).toBeUndefined();
    expect(containsUppercase('Z1234567')).toBeUndefined();
    expect(containsUppercase('12345678Y')).toBeUndefined();
    expect(containsUppercase('0123xYz456W')).toBeUndefined();
  });

  it('should return an error if the input does not contain at least one uppercase character', () => {
    expect(containsUppercase('1234567')).toEqual(errorMessage);
    expect(containsUppercase('')).toEqual(errorMessage);
    expect(containsUppercase('-_!@#$%&*()[]{}<>|?/\\')).toEqual(errorMessage);
    expect(containsUppercase(null as any)).toEqual(errorMessage);
    expect(containsUppercase(undefined as any)).toEqual(errorMessage);
    expect(containsUppercase({} as any)).toEqual(errorMessage);
    expect(containsUppercase([] as any)).toEqual(errorMessage);
  });
});
