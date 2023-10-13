export const validateIntervalRegex = /^(-?\d+(?:\.\d+)?)(ms|[Mwdhmsy])$/;

export const validateInterval = (val: string, regex: RegExp) => {
  if (val === '0') {
    return false;
  }
  const matches = val.match(regex);
  return matches || !val ? false : true;
};
