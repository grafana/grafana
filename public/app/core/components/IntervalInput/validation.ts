export const validateIntervalRegex = /^(-?\d+(?:\.\d+)?)(ms|[Mwdhmsy])$/;

export const isValidInterval = (val: string, regex: RegExp) => {
  if (val === '0') {
    return true;
  }
  const matches = val.match(regex);
  return matches || !val ? true : false;
};
