const tokenPatterns: Array<[string, string]> = [
  ['yyyy', '\\d{4}'],
  ['yy', '\\d{2}'],
  ['LLLL', '[\\p{L}.]+'],
  ['LLL', '[\\p{L}.]+'],
  ['LL', '\\d{2}'],
  ['L', '\\d{1,2}'],
  ['cccc', '[\\p{L}.]+'],
  ['ccc', '[\\p{L}.]+'],
  ['cc', '[\\p{L}]{2}'],
  ['ooo', '\\d{3}'],
  ['o', '\\d{1,3}'],
  ['dd', '\\d{2}'],
  ['d', '\\d{1,2}'],
  ['HH', '\\d{2}'],
  ['H', '\\d{1,2}'],
  ['hh', '\\d{2}'],
  ['h', '\\d{1,2}'],
  ['mm', '\\d{2}'],
  ['m', '\\d{1,2}'],
  ['ss', '\\d{2}'],
  ['s', '\\d{1,2}'],
  ['SSS', '\\d{3}'],
  ['ZZ', '(?:Z|[+-]\\d{2}:?\\d{2})'],
  ['a', '[\\p{L}.]+'],
  ['q', '\\d'],
];

const cachedFormatPrefixRegex = new Map<string, RegExp>();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildFormatPrefixRegex = (format: string) => {
  const cached = cachedFormatPrefixRegex.get(format);

  if (cached) {
    return cached;
  }

  let pattern = '^';
  for (let i = 0; i < format.length; ) {
    if (format[i] === "'") {
      let literal = '';
      i++;
      while (i < format.length) {
        if (format[i] === "'" && format[i + 1] === "'") {
          literal += "'";
          i += 2;
          continue;
        }
        if (format[i] === "'") {
          i++;
          break;
        }
        literal += format[i++];
      }
      pattern += escapeRegExp(literal);
      continue;
    }

    let matched = false;
    for (const [token, tokenPattern] of tokenPatterns) {
      if (format.slice(i, i + token.length) === token) {
        pattern += tokenPattern;
        i += token.length;
        matched = true;
        break;
      }
    }

    if (matched) {
      continue;
    }

    pattern += escapeRegExp(format[i]);
    i++;
  }

  const generatedRegex = new RegExp(pattern, 'u');

  if (cachedFormatPrefixRegex.size > 256) {
    cachedFormatPrefixRegex.delete(cachedFormatPrefixRegex.keys().next().value!);
  }

  cachedFormatPrefixRegex.set(format, generatedRegex);

  return new RegExp(pattern, 'u');
};

/**
 * Moment can support parse the input even if the format is different from the input.
 *
 * E.g.: `2021-07-19 00:00:00.000` with format `YYYY-MM-DD HH:mm:ss`
 *   -> Valid on moment
 *   -> Invalid on luxon due to missing `.SSS`
 *
 * This method will basically find the prefix of the input that matches the format.
 * In this example, it will return only the `2021-07-19 00:00:00`
 */
export function looseMomentParseFormat(input: string, format: string) {
  return input.match(buildFormatPrefixRegex(format))?.[0];
}
