// A `data-*` index signature does not stop other props from arriving through an object spread, so keep only `data-*`.
export const pickDataAttributes = (props: object): Record<`data-${string}`, string | undefined> =>
  Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith('data-')));
