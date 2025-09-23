import { DataQuery, DataTransformerConfig } from '@grafana/schema';

/**
 * Finds the next available refId for a query
 */
export const getNextRefId = (item: DataQuery[] | DataTransformerConfig[], prefix?: string): string => {
  for (let num = 0; ; num++) {
    let refId = getRefId(num);
    if (prefix !== undefined) {
      refId = `${prefix}${refId}`;
    }
    if (!item.some((i) => i.refId === refId)) {
      return refId;
    }
  }
};

function getRefId(num: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  if (num < letters.length) {
    return letters[num];
  } else {
    return getRefId(Math.floor(num / letters.length) - 1) + letters[num % letters.length];
  }
}
