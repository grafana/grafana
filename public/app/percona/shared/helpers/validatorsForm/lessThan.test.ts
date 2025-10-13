/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { lessThan } from './lessThan';

describe('Validators:: lessThen', () => {
  const errorMessage = 'Must be a number less than 100';
  const lessThenValidator = lessThan(100);

  it('should return undefined if the input contains a value which is less than 100', () => {
    expect(lessThenValidator('99')).toEqual(undefined);
    expect(lessThenValidator('-987.5')).toEqual(undefined);
    expect(lessThenValidator('-1000')).toEqual(undefined);
  });

  it('should return an error if the input is not a number or contains a value which is greater than 100', () => {
    expect(lessThenValidator((5 ** 2 * 4) as any)).toEqual(errorMessage);
    expect(lessThenValidator('1000')).toEqual(errorMessage);
    expect(lessThenValidator(true as any)).toEqual(errorMessage);
    expect(lessThenValidator(null as any)).toEqual(errorMessage);
    expect(lessThenValidator(undefined as any)).toEqual(errorMessage);
    expect(lessThenValidator('string' as any)).toEqual(errorMessage);
    expect(lessThenValidator({} as any)).toEqual(errorMessage);
    expect(lessThenValidator([] as any)).toEqual(errorMessage);
  });
});
