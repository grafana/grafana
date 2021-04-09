import { asyncScheduler, Observable, of, scheduled } from 'rxjs';

// function that creates an async of result Observable
export function toAsyncOfResult(result: any): Observable<any> {
  return scheduled(of(result), asyncScheduler);
}
