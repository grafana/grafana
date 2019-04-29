import { SelectOptionItem } from './../components/Select/Select';

export function stringToJsRegex(str: string): RegExp {
  if (str[0] !== '/') {
    return new RegExp('^' + str + '$');
  }

  const match = str.match(new RegExp('^/(.*?)/(g?i?m?y?)$'));

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
  const unit = str.substr(String(nr).length);
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

export function getIntervalFromString(strInterval: string): SelectOptionItem<number> {
  return {
    label: strInterval,
    value: stringToMs(strInterval),
  };
}
