export function ensureStringValues(value: unknown | unknown[]): string | string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return value.toString(10);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value.toString();
  }

  return '';
}
