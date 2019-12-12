import { getValueFromEventItem, promSettingsValidationEvents } from './PromSettings';
import { EventsWithValidation } from '@grafana/ui';

describe('PromSettings', () => {
  describe('getValueFromEventItem', () => {
    describe('when called with undefined', () => {
      it('then it should return empty string', () => {
        const result = getValueFromEventItem(undefined);
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
});
