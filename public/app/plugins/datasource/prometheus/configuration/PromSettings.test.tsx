import React, { SyntheticEvent } from 'react';
import { render, screen } from '@testing-library/react';
import { EventsWithValidation } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { getValueFromEventItem, promSettingsValidationEvents, PromSettings } from './PromSettings';
import { createDefaultConfigOptions } from './mocks';

describe('PromSettings', () => {
  describe('getValueFromEventItem', () => {
    describe('when called with undefined', () => {
      it('then it should return empty string', () => {
        const result = getValueFromEventItem(
          (undefined as unknown) as SyntheticEvent<HTMLInputElement> | SelectableValue<string>
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

  describe('promSettingsValidationEvents', () => {
    const validationEvents = promSettingsValidationEvents;

    it('should have one event handlers', () => {
      expect(Object.keys(validationEvents).length).toEqual(1);
    });

    it('should have an onBlur handler', () => {
      expect(validationEvents.hasOwnProperty(EventsWithValidation.onBlur)).toBe(true);
    });

    it('should have one rule', () => {
      expect(validationEvents[EventsWithValidation.onBlur].length).toEqual(1);
    });

    describe('when calling the rule with an empty string', () => {
      it('then it should return true', () => {
        expect(validationEvents[EventsWithValidation.onBlur][0].rule('')).toBe(true);
      });
    });

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
        expect(validationEvents[EventsWithValidation.onBlur][0].rule(value)).toBe(expected);
      }
    );

    it.each`
      value     | expected
      ${'1 ms'} | ${false}
      ${'1x'}   | ${false}
      ${' '}    | ${false}
      ${'w'}    | ${false}
      ${'1.0s'} | ${false}
    `(
      "when calling the rule with incorrect formatted value: '$value' then result should be '$expected'",
      ({ value, expected }) => {
        expect(validationEvents[EventsWithValidation.onBlur][0].rule(value)).toBe(expected);
      }
    );
  });
  describe('PromSettings component', () => {
    const defaultProps = createDefaultConfigOptions();

    it('should show POST httpMethod if no httpMethod and no url', () => {
      const options = defaultProps;
      options.url = '';
      options.jsonData.httpMethod = '';

      render(
        <div>
          <PromSettings onOptionsChange={() => {}} options={options} />
        </div>
      );
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
    it('should show GET httpMethod if no httpMethod and url', () => {
      const options = defaultProps;
      options.url = 'test_url';
      options.jsonData.httpMethod = '';

      render(
        <div>
          <PromSettings onOptionsChange={() => {}} options={options} />
        </div>
      );
      expect(screen.getByText('GET')).toBeInTheDocument();
    });
    it('should show POST httpMethod if POST httpMethod is configured', () => {
      const options = defaultProps;
      options.url = 'test_url';
      options.jsonData.httpMethod = 'POST';

      render(
        <div>
          <PromSettings onOptionsChange={() => {}} options={options} />
        </div>
      );
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
    it('should show GET httpMethod if GET httpMethod is configured', () => {
      const options = defaultProps;
      options.url = 'test_url';
      options.jsonData.httpMethod = 'GET';

      render(
        <div>
          <PromSettings onOptionsChange={() => {}} options={options} />
        </div>
      );
      expect(screen.getByText('GET')).toBeInTheDocument();
    });
  });
});
