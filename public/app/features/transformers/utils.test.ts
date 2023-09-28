import { config } from '@grafana/runtime';

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
    config.featureToggles.transformationsVariableSupport = true;
    expect(numberOrVariableValidator('$foo')).toBe(true);
    config.featureToggles.transformationsVariableSupport = false;
  });
  it('fails a string that has a variable if the feature flag is disabled', () => {
    config.featureToggles.transformationsVariableSupport = false;
    expect(numberOrVariableValidator('$foo')).toBe(false);
    config.featureToggles.transformationsVariableSupport = true;
  });
});
