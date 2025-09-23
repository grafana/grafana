import { Validator } from './validator.types';

export const lessThan =
  (min: number): Validator<string> =>
  (value: string) => {
    const num = parseInt(value, 10);

    if (Number.isFinite(num) && num < min) {
      return undefined;
    }

    return `Must be a number less than ${min}`;
  };
