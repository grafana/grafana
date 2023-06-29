export const validateTimeShift = (val: string) => {
  const intervalRegex = /^(-?\d+(?:\.\d+)?)(ms|[Mwdhmsy])$/;
  const matches = val.match(intervalRegex);
  return matches || !val ? false : true;
};
