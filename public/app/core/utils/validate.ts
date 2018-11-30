import { ValidationRule } from 'app/types';

export const validate = (value: string, validationRules: ValidationRule[]) => {
  const errors = validationRules.reduce((acc, currRule) => {
    if (!currRule.rule(value)) {
      return acc.concat(currRule.errorMessage);
    }
    return acc;
  }, []);
  return errors.length > 0 ? errors : null;
};
