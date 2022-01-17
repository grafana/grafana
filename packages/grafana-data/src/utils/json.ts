export const safeParseJson = (text?: string): any | undefined => {
  if (!text) {
    return;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(error);
  }
};

export const safeStringifyValue = (value: any, space?: number) => {
  if (!value) {
    return '';
  }

  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    console.error(error);
  }

  return '';
};
