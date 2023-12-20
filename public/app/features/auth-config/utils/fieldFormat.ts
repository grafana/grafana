export function toCamelCase(obj: Record<string, any>) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const camelObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, match) => match.toUpperCase());
    camelObj[camelKey] = toCamelCase(value);
  }

  return camelObj;
}

export function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const snakeObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
    snakeObj[snakeKey.slice(1)] = toSnakeCase(value);
  }

  return snakeObj;
}
