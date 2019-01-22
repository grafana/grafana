import { ValidationRule, ValidationEvents } from 'app/types';
import { EventsWithValidation } from 'app/core/components/Form/Input';

export const validate = (value: string, validationRules: ValidationRule[]) => {
  const errors = validationRules.reduce((acc, currRule) => {
    if (!currRule.rule(value)) {
      return acc.concat(currRule.errorMessage);
    }
    return acc;
  }, []);
  return errors.length > 0 ? errors : null;
};

export const hasValidationEvent = (event: EventsWithValidation, validationEvents: ValidationEvents) => {
  return validationEvents && validationEvents[event];
};
