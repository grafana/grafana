export const isRelativeFormat = (format: string): boolean => {
  return /(^now$|^now\-\d{1,16}[yMwdhms]$)/g.test(format);
};
