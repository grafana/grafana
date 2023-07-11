export const validateInterval = (val: string, regex: RegExp) => {
  const matches = val.match(regex);
  return matches || !val ? false : true;
};

export const validateIntervalRegex = /^(-?\d+(?:\.\d+)?)(ms|[Mwdhmsy])$/;
