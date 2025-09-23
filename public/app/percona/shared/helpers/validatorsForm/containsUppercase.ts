import { Validator } from './validator.types';

const errorMessage = 'Must include at least one uppercase letter';
const casesRegexp = /^(?=.*[A-Z])/gm;

export const containsUppercase: Validator<string> = (value: string) => {
  if (typeof value !== 'string') {
    return errorMessage;
  }

  if (casesRegexp.test(value)) {
    return undefined;
  }

  return errorMessage;
};
