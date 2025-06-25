/**
 * Ensures a string is compatible with Prometheus' UTF-8 handling rules.
 *
 * Prometheus has specific rules for handling UTF-8 strings in metric names and label values:
 * - Legacy names (matching pattern [a-zA-Z_:][a-zA-Z0-9_:]*) are used as-is
 * - Non-legacy names containing UTF-8 characters must be wrapped in double quotes
 *
 * @param value - The string to make UTF-8 compatible
 * @returns The original string if it's empty or a valid legacy name, otherwise the string wrapped in double quotes
 *
 * @example
 * utf8Support('metric_name') // returns 'metric_name'
 * utf8Support('metric-📈') // returns '"metric-📈"'
 */
export const utf8Support = (value: string) => {
  if (value === '') {
    return value;
  }
  const isLegacyLabel = isValidLegacyName(value);
  if (isLegacyLabel) {
    return value;
  }
  return `"${value}"`;
};

/**
 * Escapes a string to make it compatible with Prometheus UTF-8 support.
 *
 * This function converts non-legacy name characters to an escaped format:
 * - Underscores are doubled as '__'
 * - Valid legacy runes are preserved as-is
 * - Invalid code points are replaced with '_FFFD_'
 * - Other characters are converted to '_HEX_' format where HEX is the hexadecimal code point
 *
 * @param value - The string to escape
 * @returns An escaped string prefixed with 'U__' that is compatible with Prometheus
 *
 * @example
 * escapeForUtf8Support("my lovely_http.status:sum") // returns U__my_20_lovely__http_2e_status:sum
 * escapeForUtf8Support("label with 😱") // returns U__label_20_with_20__1f631_
 */
export const escapeForUtf8Support = (value: string) => {
  const isLegacyLabel = isValidLegacyName(value);
  if (isLegacyLabel) {
    return value;
  }

  let escaped = 'U__';

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const codePoint = value.codePointAt(i);

    if (char === '_') {
      escaped += '__';
    } else if (codePoint !== undefined && isValidLegacyRune(char, i)) {
      escaped += char;
    } else if (codePoint === undefined || !isValidCodePoint(codePoint)) {
      escaped += '_FFFD_';
    } else {
      escaped += '_';
      escaped += codePoint.toString(16); // Convert code point to hexadecimal
      escaped += '_';
    }

    // Handle surrogate pairs for characters outside the Basic Multilingual Plane
    if (codePoint !== undefined && codePoint > 0xffff) {
      i++; // Skip the second half of the surrogate pair
    }
  }

  return escaped;
};

/**
 * Checks if a string is a valid legacy (the standard) Prometheus metric or label name.
 *
 * Valid legacy (the standard) names match the pattern [a-zA-Z_:][a-zA-Z0-9_:]* which means:
 * - First character must be a letter, underscore, or colon
 * - Remaining characters can only be letters, numbers, underscores, or colons
 *
 * @param name - The string to check
 * @returns true if the string is a valid legacy (the standard) name, false otherwise
 */
export const isValidLegacyName = (name: string): boolean => {
  if (name.length === 0) {
    return false;
  }

  for (let i = 0; i < name.length; i++) {
    const char = name[i];
    if (!isValidLegacyRune(char, i)) {
      return false;
    }
  }

  return true;
};

/**
 * Checks if a character is valid for a legacy (the standard) Prometheus metric or label name.
 *
 * This is an implementation of the Prometheus model rune validation logic, which
 * determines if a character is allowed in a legacy metric or label name.
 * https://github.com/prometheus/common/blob/v0.64.0/model/metric.go#L430-L432
 *
 * @param char - The character to check
 * @param index - The position of the character in the string
 * @returns true if the character is valid at the given position, false otherwise
 */
const isValidLegacyRune = (char: string, index: number): boolean => {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    return false;
  }

  return (
    (codePoint >= 97 && codePoint <= 122) || // 'a' to 'z'
    (codePoint >= 65 && codePoint <= 90) || // 'A' to 'Z'
    codePoint === 95 || // '_'
    codePoint === 58 || // ':'
    (codePoint >= 48 && codePoint <= 57 && index > 0) // '0' to '9', but not at the start
  );
};

/**
 * Validates if a Unicode code point is valid for UTF-8 encoding.
 *
 * @param codePoint - The Unicode code point to validate
 * @returns true if the code point is valid (between 0 and 0x10FFFF), false otherwise
 */
const isValidCodePoint = (codePoint: number): boolean => {
  return codePoint >= 0 && codePoint <= 0x10ffff;
};

/**
 * Wraps each key in a Prometheus filter string with UTF-8 support.
 *
 * This function processes a filter string (e.g. 'metric="value",name=~"pattern"')
 * and applies UTF-8 support to each key while preserving the operators and values.
 * It handles quoted values and comma separators correctly.
 *
 * @param filterStr - The filter string to process
 * @returns A new filter string with UTF-8 support applied to the keys
 */
export const wrapUtf8Filters = (filterStr: string): string => {
  const resultArray: string[] = [];
  const operatorRegex = /(=~|!=|!~|=)/; // NOTE: the order of the operators is important here
  let currentKey = '';
  let currentValue = '';
  let inQuotes = false;
  let temp = '';
  const addResult = () => {
    const operatorMatch = temp.match(operatorRegex);
    if (operatorMatch) {
      const operator = operatorMatch[0];
      [currentKey, currentValue] = temp.split(operator);
      resultArray.push(`${utf8Support(currentKey.trim())}${operator}"${currentValue.slice(1, -1)}"`);
    }
  };

  for (const char of filterStr) {
    if (char === '"' && temp[temp.length - 1] !== '\\') {
      // Toggle inQuotes when an unescaped quote is found
      inQuotes = !inQuotes;
      temp += char;
    } else if (char === ',' && !inQuotes) {
      // When outside quotes and encountering ',', finalize the current pair
      addResult();
      temp = ''; // Reset for the next pair
    } else {
      // Collect characters
      temp += char;
    }
  }

  // Handle the last key-value pair
  if (temp) {
    addResult();
  }
  return resultArray.join(',');
};
