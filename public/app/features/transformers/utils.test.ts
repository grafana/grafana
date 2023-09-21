import { numberOrVariableValidator } from './utils';

describe('validator', () => {
  it('validates a number', () => {
    expect(numberOrVariableValidator(1)).toBe(true);
  });

  it('validates a string that is an integer', () => {
    expect(numberOrVariableValidator('1')).toBe(true);
  });

  it('validats a string that is not a float', () => {
    expect(numberOrVariableValidator('1.2')).toBe(true);
  });

  it('fails a string that is not a number', () => {
    expect(numberOrVariableValidator('foo')).toBe(false);
  });

  it('validates a string that has a variable', () => {
    expect(numberOrVariableValidator('${foo}')).toBe(true);
  });
});
