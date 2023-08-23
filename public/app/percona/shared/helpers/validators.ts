import { Validator, VResult } from './validator.types';

export const validators = {
  validatePort: (value: any) => {
    const portNumber = Number(value);
    const MIN_PORT_NUMBER = 0;
    const MAX_PORT_NUMBER = 65535;

    if (portNumber > MIN_PORT_NUMBER && portNumber < MAX_PORT_NUMBER && Number.isFinite(portNumber)) {
      return undefined;
    }

    return 'Port should be a number and between 0 and 65535';
  },
  validateUrl: (value: string) => {
    const urlRe = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;

    return urlRe.test(value) ? undefined : 'Invalid URL string';
  },
  range: (from: number, to: number) => (value: any) => {
    if (!value) {
      return undefined;
    }

    return value >= from && value <= to ? undefined : `Value should be in the range from ${from} to ${to}`;
  },

  min: (from: number) => (value: any) => {
    if (!value && value !== 0) {
      return undefined;
    }

    return value >= from ? undefined : `Value should be greater or equal to ${from}`;
  },

  validateEmail: (value: string) => {
    const emailRe =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

    return emailRe.test(value) ? undefined : 'Invalid email address';
  },

  validateKeyValue: (value: string) => {
    if (
      value &&
      !value
        .split(/[\n\s]/)
        .filter(Boolean)
        .every((element) => {
          const [key, value, ...rest] = element.split(':');

          // check key against prometheus data model
          // https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels
          if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) && !key.startsWith('__') && !!value && !rest.length) {
            return true;
          }

          return false;
        })
    ) {
      return 'Values have to be in key:value format, and separated with new line or space';
    }

    return undefined;
  },

  containBothCases: (value: string) => {
    const casesRegexp = new RegExp('^(?=.*[a-z])(?=.*[A-Z])');

    if (casesRegexp.test(value)) {
      return undefined;
    }

    return 'Must include upper and lower cases';
  },

  containNumbers: (value: string) => {
    const numbersRegexp = new RegExp('^(?=.*[0-9])');

    if (numbersRegexp.test(value)) {
      return undefined;
    }

    return 'Must include numbers';
  },

  maxLength: (numberOfCharacters: number) => (value: string) => {
    if (value.length <= numberOfCharacters) {
      return undefined;
    }

    return `Must contain at most ${numberOfCharacters} characters`;
  },

  minLength: (numberOfCharacters: number) => (value: string) => {
    if (value.length >= numberOfCharacters) {
      return undefined;
    }

    return `Must contain at least ${numberOfCharacters} characters`;
  },

  required: (value: any) => (value ? undefined : 'Required field'),

  requiredTrue: (value: boolean) => (value === true ? undefined : 'Required field'),

  compose:
    (...validators: Validator[]) =>
    (value: any, values?: Record<string, any>): VResult => {
      let result: string | undefined;

      // eslint-disable-next-line no-restricted-syntax
      for (const validator of validators) {
        result = validator(value, values);
        if (result !== undefined) {
          break;
        }
      }

      return result;
    },
};

export default validators;
