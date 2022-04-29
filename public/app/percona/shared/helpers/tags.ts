export const sameTags = (a: string[] = [], b: string[] = []) => {
  const same = a.length === b.length && a.every((tag) => b.includes(tag));
  return same;
};
