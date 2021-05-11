export const isRelativeFormat = (format: string): boolean => {
  return /(^now$|^now\-\d{1,16}[wdhms]$)/g.test(format);
};
