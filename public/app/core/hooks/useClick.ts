import { Ref, useEffect, useRef } from 'react';
import { fromEvent, merge, Unsubscribable } from 'rxjs';
import { bufferTime, filter, tap } from 'rxjs/operators';

export const useClick = (ref: any, onClick: any, onDoubeClick: any) => {
  const clickSubscription = useRef<Unsubscribable>(null);

  useEffect(() => {
    const fromEventStream = fromEvent(ref.current, 'click').pipe(bufferTime(1000));
    const clickStream = fromEventStream.pipe(
      filter(buffer => buffer.length === 1),
      tap(onClick)
    );

    const doubleClickStream = fromEventStream.pipe(
      filter(buffer => buffer.length === 2),
      tap(onDoubeClick)
    );

    clickSubscription.current = merge(clickStream, doubleClickStream).subscribe();

    return () => {
      if (clickSubscription.current) {
        console.log('unsubscribing');
        clickSubscription.current.unsubscribe();
      }
    };
  }, [ref, onClick, onDoubeClick]);
};
