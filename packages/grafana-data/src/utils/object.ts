export const objRemoveUndefined = (obj: { [key: string]: unknown }) => {
  return Object.keys(obj).reduce((acc: { [key: string]: unknown }, key) => {
    if (obj[key] !== undefined) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

export const isEmptyObject = (value: unknown): value is Record<string, never> => {
  return typeof value === 'object' && value !== null && Object.keys(value).length === 0;
};

/** Stringifies an object that may contain circular references */
export function safeStringifyValue(value: unknown) {
  const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (_: string, value: object | null) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }

      return value;
    };
  };

  return JSON.stringify(value, getCircularReplacer());
}
