import React, { useState, useEffect } from 'react';
import { type Observable } from 'rxjs';

interface Props<T> {
  watch: Observable<T>;
  child: React.ComponentType<T>;
  initialSubProps: T;
}

export function ObservablePropsWrapper<T extends {}>({ watch, child: Child, initialSubProps }: Props<T>) {
  const [subProps, setSubProps] = useState<T>(initialSubProps);

  useEffect(() => {
    const sub = watch.subscribe({
      next: setSubProps,
      complete: () => {},
      error: (err) => {},
    });
    return () => sub.unsubscribe();
  }, [watch]);

  return <Child {...subProps} />;
}
