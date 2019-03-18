import { ValidationRule, ValidationEvents } from '../types/input';

export enum EventsWithValidation {
  onBlur = 'onBlur',
  onFocus = 'onFocus',
  onChange = 'onChange',
}

export const validate = (value: string, validationRules: ValidationRule[]) => {
  const errors = validationRules.reduce(
    (acc, currRule) => {
      if (!currRule.rule(value)) {
        return acc.concat(currRule.errorMessage);
      }
      return acc;
    },
    [] as string[]
  );
  return errors.length > 0 ? errors : null;
};

export const hasValidationEvent = (event: EventsWithValidation, validationEvents: ValidationEvents | undefined) => {
  return validationEvents && validationEvents[event];
};
