import { Validator } from './validator.types';

export const containsLowercase: Validator = (value: string) => {
  const casesRegexp = /^(?=.*[a-z])/gm;

  if (casesRegexp.test(value)) {
    return undefined;
  }

  return 'Must include at least one lowercase letter';
};
