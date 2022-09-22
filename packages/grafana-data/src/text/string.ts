import { camelCase } from 'lodash';

const specialChars = ['(', '[', '{', '}', ']', ')', '\\', '|', '*', '+', '-', '.', '?', '<', '>', '#', '&', '^', '$'];
const specialMatcher = '([\\' + specialChars.join('\\') + '])';
const specialCharEscape = new RegExp(specialMatcher, 'g');
const specialCharUnescape = new RegExp('(\\\\)' + specialMatcher, 'g');

export const escapeStringForRegex = (value: string) => {
  if (!value) {
    return value;
  }

  return value.replace(specialCharEscape, '\\$1');
};

export const unEscapeStringFromRegex = (value: string) => {
  if (!value) {
    return value;
  }

  return value.replace(specialCharUnescape, '$2');
};

export function stringStartsAsRegEx(str: string): boolean {
  if (!str) {
    return false;
  }

  return str[0] === '/';
}

export function stringToJsRegex(str: string): RegExp {
  if (!stringStartsAsRegEx(str)) {
    return new RegExp(`^${str}$`);
  }

  const match = str.match(new RegExp('^/(.*?)/(g?i?m?y?s?)$'));

  if (!match) {
    throw new Error(`'${str}' is not a valid regular expression.`);
  }

  return new RegExp(match[1], match[2]);
}

export function stringToMs(str: string): number {
  if (!str) {
    return 0;
  }

  const nr = parseInt(str, 10);
  const unit = str.slice(String(nr).length);
  const s = 1000;
  const m = s * 60;
  const h = m * 60;
  const d = h * 24;

  switch (unit) {
    case 's':
      return nr * s;
    case 'm':
      return nr * m;
    case 'h':
      return nr * h;
    case 'd':
      return nr * d;
    default:
      if (!unit) {
        return isNaN(nr) ? 0 : nr;
      }
      throw new Error('Not supported unit: ' + unit);
  }
}

export function toNumberString(value: number | undefined | null): string {
  if (value !== null && value !== undefined && Number.isFinite(value as number)) {
    return value.toString();
  }
  return '';
}

export function toIntegerOrUndefined(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const v = parseInt(value, 10);
  return isNaN(v) ? undefined : v;
}

export function toFloatOrUndefined(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const v = parseFloat(value);
  return isNaN(v) ? undefined : v;
}

export const toPascalCase = (string: string) => {
  const str = camelCase(string);
  return str.charAt(0).toUpperCase() + str.substring(1);
};
