import { numberOrVariableValidator } from './utils';

describe('validator', () => {
  it('validates a positive number', () => {
    expect(numberOrVariableValidator(1)).toBe(true);
  });

  it('validates a negative number', () => {
    expect(numberOrVariableValidator(-1)).toBe(true);
  });

  it('validates zero', () => {
    expect(numberOrVariableValidator(0)).toBe(true);
  });

  it('validates a float', () => {
    expect(numberOrVariableValidator(1.2)).toBe(true);
  });

  it('validates a negative float', () => {
    expect(numberOrVariableValidator(1.2)).toBe(true);
  });

  it('validates a string that is a positive integer', () => {
    expect(numberOrVariableValidator('1')).toBe(true);
  });

  it('validats a string that is a negative integer', () => {
    expect(numberOrVariableValidator('-1')).toBe(true);
  });

  it('validats a string that is zero', () => {
    expect(numberOrVariableValidator('0')).toBe(true);
  });

  it('validats a string that is a float', () => {
    expect(numberOrVariableValidator('1.2')).toBe(true);
  });

  it('validats a string that is a negative float', () => {
    expect(numberOrVariableValidator('-1.2')).toBe(true);
  });

  it('fails a string that is not a number', () => {
    expect(numberOrVariableValidator('foo')).toBe(false);
  });

  it('validates a string that has a variable', () => {
    expect(numberOrVariableValidator('$foo')).toBe(true);
  });

  it('fails a string that has multiple variables', () => {
    expect(numberOrVariableValidator('$foo$asd')).toBe(false);
  });
});
