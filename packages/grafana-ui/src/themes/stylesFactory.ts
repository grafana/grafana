import memoizeOne from 'memoize-one';
import { KeyValue } from '@grafana/data';

/**
 *  Creates memoized version of styles creator
 * @param stylesCreator function accepting component's props and state and returning object with class names
 */

export function stylesFactory<TProps, TState, TResult extends KeyValue<string>>(
  stylesCreator: (props: TProps, state?: TState) => TResult
): (props: TProps, state?: TState) => TResult {
  return memoizeOne(stylesCreator);
}
