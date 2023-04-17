import React from 'react';

import { FieldValidationMessage } from '@grafana/ui';

import { validateInput } from './ConfigEditor';
import { DURATION_REGEX } from './PromSettings';

// replaces promSettingsValidationEvents to display a <FieldValidationMessage> onBlur for duration input errors
describe('promSettings validateInput', () => {
  it.each`
    value    | expected
    ${'1ms'} | ${true}
    ${'1M'}  | ${true}
    ${'1w'}  | ${true}
    ${'1d'}  | ${true}
    ${'1h'}  | ${true}
    ${'1m'}  | ${true}
    ${'1s'}  | ${true}
    ${'1y'}  | ${true}
  `(
    "when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, DURATION_REGEX)).toBe(expected);
    }
  );

  const error = <FieldValidationMessage>Value is not valid</FieldValidationMessage>;
  it.each`
    value     | expected
    ${'1 ms'} | ${error}
    ${'1x'}   | ${error}
    ${' '}    | ${error}
    ${'w'}    | ${error}
    ${'1.0s'} | ${error}
  `(
    "when calling the rule with incorrect formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, DURATION_REGEX)).toStrictEqual(expected);
    }
  );

  it('should display a custom validation message', () => {
    const invalidDuration = 'invalid';
    const customMessage = 'This is invalid input';
    const errorWithCustomMessage = <FieldValidationMessage>{customMessage}</FieldValidationMessage>;
    expect(validateInput(invalidDuration, DURATION_REGEX, customMessage)).toStrictEqual(errorWithCustomMessage);
  });
});
