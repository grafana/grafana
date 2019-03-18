import { EventsWithValidation, ValidationEvents, ValidationRule } from '../types';

export const validate = (value: string, validationRules: ValidationRule[]) => {
  const errors = validationRules.reduce((acc, currentRule) => {
    if (!currentRule.rule(value)) {
      return acc.concat(currentRule.errorMessage);
    }
    return acc;
  }, []);
  return errors.length > 0 ? errors : null;
};

export const hasValidationEvent = (event: EventsWithValidation, validationEvents?: ValidationEvents) => {
  return validationEvents && validationEvents[event];
};
