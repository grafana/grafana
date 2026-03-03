import { useState, useEffect, ComponentType } from 'react';
import { Observable } from 'rxjs';

interface Props<T> {
  watch: Observable<T>;
  child: ComponentType<T>;
  initialSubProps: T;
}

export function ObservablePropsWrapper<T extends {}>({ watch, child: Child, initialSubProps }: Props<T>) {
  const [subProps, setSubProps] = useState<T>(initialSubProps);

  useEffect(() => {
    const subscription = watch.subscribe({
      next: setSubProps,
      complete: () => {},
      error: () => {},
    });
    return () => subscription.unsubscribe();
    // original class component did not handle re-subscribes,
    // if we need that moving forward just add watch to the dependency array
    // and remove eslint comment below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Child {...subProps} />;
}
