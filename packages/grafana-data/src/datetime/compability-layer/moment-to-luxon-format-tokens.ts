const tokenMap: Array<[string, string]> = [
  ['YYYY', 'yyyy'],
  ['YY', 'yy'],
  ['MMMM', 'LLLL'],
  ['MMM', 'LLL'],
  ['MM', 'LL'],
  ['M', 'L'],
  ['DDDD', 'ooo'],
  ['DDD', 'o'],
  ['DD', 'dd'],
  ['D', 'd'],
  ['dddd', 'cccc'],
  ['ddd', 'ccc'],
  ['dd', 'cc'],
  ['A', 'a'],
  ['a', 'a'],
  ['HH', 'HH'],
  ['H', 'H'],
  ['hh', 'hh'],
  ['h', 'h'],
  ['mm', 'mm'],
  ['m', 'm'],
  ['ss', 'ss'],
  ['s', 's'],
  ['SSS', 'SSS'],
  ['Q', 'q'],
  ['ZZ', 'ZZ'],
  ['Z', 'ZZ'],
];

const cachedLuxonFormats = new Map<string, string>();

/**
 * Not all tokens from moment are supported by Luxon.
 *
 * Luxon ref: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
 * Moment ref: https://momentjs.com/docs/#/displaying/format/
 */
export const toLuxonFormat = (format: string) => {
  const cached = cachedLuxonFormats.get(format);

  if (cached) {
    return cached;
  }

  let output = '';
  for (let i = 0; i < format.length; ) {
    const escaped = format[i] === '\\' && i + 1 < format.length;
    if (escaped) {
      output += `'${format[i + 1].replace(/'/g, "''")}'`;
      i += 2;
      continue;
    }

    let matched = false;
    for (const [momentToken, luxonToken] of tokenMap) {
      if (format.slice(i, i + momentToken.length) === momentToken) {
        output += luxonToken;
        i += momentToken.length;
        matched = true;
        break;
      }
    }

    if (matched) {
      continue;
    }

    const char = format[i];
    output += /[A-Za-z_]/.test(char) ? `'${char.replace(/'/g, "''")}'` : char;
    i++;
  }

  if (cachedLuxonFormats.size > 256) {
    cachedLuxonFormats.delete(cachedLuxonFormats.keys().next().value!);
  }

  cachedLuxonFormats.set(format, output);

  return output;
};
