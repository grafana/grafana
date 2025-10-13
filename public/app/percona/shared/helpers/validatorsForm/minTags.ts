import { Validator } from './validator.types';

export const minTags =
  (length: number): Validator =>
  (value: string) => {
    if (value != null && value.length >= length) {
      return undefined;
    }

    return `Must contain at least ${length} tag${length > 1 ? 's' : ''}`;
  };
