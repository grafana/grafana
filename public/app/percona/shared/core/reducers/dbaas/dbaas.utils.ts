export const prepareSourceRanges = (sourceRanges: Array<{ sourceRange: string | null }>): string[] =>
  sourceRanges.reduce((acc: string[], item): string[] => (!!item?.sourceRange ? [...acc, item?.sourceRange] : acc), []);
