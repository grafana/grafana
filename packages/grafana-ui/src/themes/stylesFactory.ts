import memoizeOne from 'memoize-one';
import { KeyValue } from '@grafana/data';

/**
 *  Creates memoized version of styles creator
 * @param stylesCreator function accepting dependencies based on which styles are created
 */
export function stylesFactory<TDeps, TResult extends KeyValue<string>>(
  stylesCreator: (deps?: TDeps) => TResult
): (deps?: TDeps) => TResult {
  return memoizeOne(stylesCreator);
}
