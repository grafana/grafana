import { Validator } from './validator.types';

export const maxLength =
  (length: number): Validator =>
  (value: string) => {
    // This will avoid breaking the validador in cases when `value` is undefined
    if (value == null) {
      return undefined;
    }

    if (value.length <= length) {
      return undefined;
    }

    return `Must contain at most ${length} characters`;
  };
