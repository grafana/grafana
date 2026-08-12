let counter = 0;

export function uniqueId(prefix = ''): string {
  return `${prefix}${++counter}`;
}
