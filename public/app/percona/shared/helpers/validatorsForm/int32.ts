import { INT_32 } from '../../core';

export const int32 = (value: string) => {
  const num = parseFloat(value);
  if (Number.isFinite(num) && Number.isInteger(num) && num > INT_32.min - 1 && num < INT_32.max + 1) {
    return undefined;
  }

  return `Must be an Integer number`;
};
