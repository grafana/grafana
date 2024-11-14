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
