import { merge, Observable, timer } from 'rxjs';
import { mapTo, takeUntil } from 'rxjs/operators';

export type WithLoadingIndicatorOptions<T> = {
  whileLoading: T;
  source: Observable<T>;
};

export function withLoadingIndicator<T>({ whileLoading, source }: WithLoadingIndicatorOptions<T>): Observable<T> {
  return merge(timer(200).pipe(mapTo(whileLoading), takeUntil(source)), source);
}
