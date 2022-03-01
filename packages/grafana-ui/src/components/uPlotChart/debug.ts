// @ts-ignore
export const debugLog = (...args) => {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') {
    return;
  }
  console.log(...args);
};
