import { merge, Observable, timer } from 'rxjs';
import { mapTo, takeUntil } from 'rxjs/operators';

/**
 * @internal
 */
export type WithLoadingIndicatorOptions<T> = {
  whileLoading: T;
  source: Observable<T>;
};

/**
 * @internal
 */
export function withLoadingIndicator<T>({ whileLoading, source }: WithLoadingIndicatorOptions<T>): Observable<T> {
  return merge(timer(200).pipe(mapTo(whileLoading), takeUntil(source)), source);
}
