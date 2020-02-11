import { debounce, memoize } from 'lodash';

export default (func: (...args: any[]) => void, wait = 7000) => {
  const mem = memoize(
    (...args) =>
      debounce(func, wait, {
        leading: true,
      }),
    (...args) => JSON.stringify(args)
  );

  return (...args: any[]) => mem(...args)(...args);
};
