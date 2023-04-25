import { Validator } from './validator.types';

export const containsNumber: Validator = (value: string) => {
  const casesRegexp = /^(?=.*[0-9])/gm;

  if (casesRegexp.test(value)) {
    return undefined;
  }

  return 'Must include at least one number';
};
