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

export const safeStringifyValue = (value: unknown, space?: number) => {
  if (value === undefined || value === null) {
    return '';
  }

  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    console.error(error);
  }

  return '';
};
