/**
 * Converts a string to Start Case (each word capitalized).
 * Handles camelCase, snake_case, and kebab-case inputs.
 */
export const startCase = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
};

/**
 * Converts a string to kebab-case.
 * Handles camelCase, spaces, and special characters.
 */
export const kebabCase = (value: string): string => {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
};

/**
 * Uppercases the first character of the string and leaves the rest untouched.
 */
export const upperFirst = (value: string): string => {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
};

/**
 * Uppercases the first character of the string and lowercases the rest.
 */
export const capitalize = (value: string): string => {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};
