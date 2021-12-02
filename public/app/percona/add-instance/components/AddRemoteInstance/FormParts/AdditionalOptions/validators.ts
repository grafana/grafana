export const noSymbolsValidator = (value: string) => {
  const sybmolsRegexp = new RegExp('^[\\w\\d, ]*$');

  if (sybmolsRegexp.test(value)) {
    return undefined;
  }

  return 'The name of collector cannot contain symbols';
};
