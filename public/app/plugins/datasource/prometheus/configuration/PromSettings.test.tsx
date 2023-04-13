import { render, screen } from '@testing-library/react';
import React, { SyntheticEvent } from 'react';
import { Provider } from 'react-redux';

import { SelectableValue } from '@grafana/data';
import { FieldValidationMessage } from '@grafana/ui';

import { configureStore } from '../../../../store/configureStore';

import { DURATION_REGEX, getValueFromEventItem, PromSettings, validateDurationInput } from './PromSettings';
import { createDefaultConfigOptions } from './mocks';

describe('PromSettings', () => {
  describe('getValueFromEventItem', () => {
    describe('when called with undefined', () => {
      it('then it should return empty string', () => {
        const result = getValueFromEventItem(
          undefined as unknown as SyntheticEvent<HTMLInputElement> | SelectableValue<string>
        );
        expect(result).toEqual('');
      });
    });

    describe('when called with an input event', () => {
      it('then it should return value from currentTarget', () => {
        const value = 'An input value';
        const result = getValueFromEventItem({ currentTarget: { value } });
        expect(result).toEqual(value);
      });
    });

    describe('when called with a select event', () => {
      it('then it should return value', () => {
        const value = 'A select value';
        const result = getValueFromEventItem({ value });
        expect(result).toEqual(value);
      });
    });
  });

  // replaces promSettingsValidationEvents to display a <FieldValidationMessage> onBlur for duration input errors
  describe('promSettings validateDurationInput', () => {
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
        expect(validateDurationInput(value, DURATION_REGEX)).toBe(expected);
      }
    );

    const error = (
      <FieldValidationMessage>
        Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s
      </FieldValidationMessage>
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
        expect(validateDurationInput(value, DURATION_REGEX)).toStrictEqual(expected);
      }
    );

    it('should display a custom validation message', () => {
      const invalidDuration = 'invalid';
      const customMessage = 'This is invalid';
      const errorWithCustomMessage = <FieldValidationMessage>{customMessage}</FieldValidationMessage>;
      expect(validateDurationInput(invalidDuration, DURATION_REGEX, customMessage)).toStrictEqual(
        errorWithCustomMessage
      );
    });
  });

  describe('PromSettings component', () => {
    const defaultProps = createDefaultConfigOptions();

    it('should show POST httpMethod if no httpMethod', () => {
      const options = defaultProps;
      options.url = '';
      options.jsonData.httpMethod = '';
      const store = configureStore();

      render(
        <Provider store={store}>
          <PromSettings onOptionsChange={() => {}} options={options} />
        </Provider>
      );
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
    it('should show POST httpMethod if POST httpMethod is configured', () => {
      const options = defaultProps;
      options.url = 'test_url';
      options.jsonData.httpMethod = 'POST';
      const store = configureStore();

      render(
        <Provider store={store}>
          <PromSettings onOptionsChange={() => {}} options={options} />
        </Provider>
      );
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
    it('should show GET httpMethod if GET httpMethod is configured', () => {
      const options = defaultProps;
      options.url = 'test_url';
      options.jsonData.httpMethod = 'GET';
      const store = configureStore();

      render(
        <Provider store={store}>
          <PromSettings onOptionsChange={() => {}} options={options} />
        </Provider>
      );
      expect(screen.getByText('GET')).toBeInTheDocument();
    });
  });
});
