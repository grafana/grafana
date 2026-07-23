import { useIsomorphicLayoutEffect } from '@react-hookz/web';
import { useState } from 'react';
import { type Observable } from 'rxjs';

export function useObservable<T>(observable$: Observable<T>): T | undefined;
export function useObservable<T>(observable$: Observable<T>, initialValue: T): T;
export function useObservable<T>(observable$: Observable<T>, initialValue?: T): T | undefined {
  const [value, setValue] = useState<T | undefined>(initialValue);

  useIsomorphicLayoutEffect(() => {
    const subscription = observable$.subscribe(setValue);
    return () => subscription.unsubscribe();
  }, [observable$]);

  return value;
}
