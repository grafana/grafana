import { memoize } from 'lodash';
import { createSelectorCreator } from 'reselect';

const hashFn = (...args) => args.reduce((acc, val) => acc + '-' + JSON.stringify(val), '');
export const createLodashMemoizedSelector = createSelectorCreator(memoize as any, hashFn);
