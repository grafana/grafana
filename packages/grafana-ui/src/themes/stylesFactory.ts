import memoize from 'micro-memoize';

/**
 * @public
 * @deprecated use useStyles hook
 *  Creates memoized version of styles creator
 * @param stylesCreator function accepting dependencies based on which styles are created
 */
export function stylesFactory<ResultFn extends (...newArgs: any[]) => ReturnType<ResultFn>>(stylesCreator: ResultFn) {
  return memoize(stylesCreator);
}
