// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/ConfigEditor.test.tsx
import { FieldValidationMessage } from '@grafana/ui';

import { DURATION_REGEX, MULTIPLE_DURATION_REGEX } from '../constants';

import { validateInput } from './shared/utils';

const VALID_URL_REGEX = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;

const error = <FieldValidationMessage>Value is not valid</FieldValidationMessage>;
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
    "Single duration regex, when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, DURATION_REGEX)).toBe(expected);
    }
  );

  it.each`
    value      | expected
    ${'1M 2s'} | ${true}
    ${'1w 2d'} | ${true}
    ${'1d 2m'} | ${true}
    ${'1h 2m'} | ${true}
    ${'1m 2s'} | ${true}
  `(
    "Multiple duration regex, when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, MULTIPLE_DURATION_REGEX)).toBe(expected);
    }
  );

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

  it.each`
    value          | expected
    ${'frp://'}    | ${error}
    ${'htp://'}    | ${error}
    ${'httpss:??'} | ${error}
    ${'http@//'}   | ${error}
    ${'http:||'}   | ${error}
    ${'http://'}   | ${error}
    ${'https://'}  | ${error}
    ${'ftp://'}    | ${error}
  `(
    "Url incorrect formatting, when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, VALID_URL_REGEX)).toStrictEqual(expected);
    }
  );

  it.each`
    value                | expected
    ${'ftp://example'}   | ${true}
    ${'http://example'}  | ${true}
    ${'https://example'} | ${true}
  `(
    "Url correct formatting, when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, VALID_URL_REGEX)).toBe(expected);
    }
  );

  it('should display a custom validation message', () => {
    const invalidDuration = 'invalid';
    const customMessage = 'This is invalid';
    const errorWithCustomMessage = <FieldValidationMessage>{customMessage}</FieldValidationMessage>;
    expect(validateInput(invalidDuration, DURATION_REGEX, customMessage)).toStrictEqual(errorWithCustomMessage);
  });
});
