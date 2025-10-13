import { Validator } from './validator.types';

export const greaterThan =
  (min: number): Validator<string> =>
  (value: string) => {
    const num = parseInt(value, 10);

    if (Number.isFinite(num) && num > min) {
      return undefined;
    }

    return `Must be a number greater than ${min}`;
  };
