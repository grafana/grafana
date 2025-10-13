/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { GetSelectValueFunction, Validator, VResult } from './validator.types';

export const compose =
  (validators: Validator[], getValue?: GetSelectValueFunction<any>) =>
  (value: any, values?: Record<string, any>, meta?: any): VResult => {
    let result: string | undefined;

    // eslint-disable-next-line no-restricted-syntax
    for (const validator of validators) {
      if (getValue) {
        result = validator(getValue(value), values, meta);
      } else {
        result = validator(value, values, meta);
      }

      if (result !== undefined) {
        break;
      }
    }

    return result;
  };
