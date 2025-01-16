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

// const labelNamePriorToUtf8Support = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
// instead of regex we use rune check (converted from prometheus code)
// https://github.com/prometheus/common/blob/main/model/metric.go#L426-L428
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

const isValidCodePoint = (codePoint: number): boolean => {
  // Validate the code point for UTF-8 compliance if needed.
  return codePoint >= 0 && codePoint <= 0x10ffff;
};
