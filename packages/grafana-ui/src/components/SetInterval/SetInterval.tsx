import { isEqual } from 'lodash';
import { useEffect, useRef } from 'react';
import { interval, Subscription, Subject, of, NEVER } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';

import { stringToMs, SelectableValue } from '@grafana/data';

import { RefreshPicker } from '../RefreshPicker/RefreshPicker';

export function getIntervalFromString(strInterval: string): SelectableValue<number> {
  return {
    label: strInterval,
    value: stringToMs(strInterval),
  };
}

interface Props {
  func: () => unknown;
  loading: boolean;
  interval: string;
}

export const SetInterval = ({ func, loading, interval: intervalStr }: Props) => {
  const propsSubjectRef = useRef<Subject<Props> | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const prevPropsRef = useRef<Props>({ func, loading, interval: intervalStr });

  useEffect(() => {
    propsSubjectRef.current = new Subject<Props>();
    subscriptionRef.current = propsSubjectRef.current
      .pipe(
        // switchMap creates a new observables based on the input stream,
        // which becomes part of the propsSubject stream
        switchMap((props) => {
          // If the query is live, empty value is emitted. `of` creates single value,
          // which is merged to propsSubject stream
          if (RefreshPicker.isLive(props.interval)) {
            return of({});
          }

          // When query is loading, a new stream is merged. But it's a stream that emits no values(NEVER),
          // hence next call of this function will happen when query changes, and new props are passed into this component
          // When query is NOT loading, a new value is emitted, this time it's an interval value,
          // which makes tap function below execute on that interval basis.
          return props.loading ? NEVER : interval(stringToMs(props.interval));
        }),
        // tap will execute function passed by props
        // * on value from `of` stream merged if query is live
        // * on specified interval (triggered by values emitted by interval)
        tap(() => {
          propsSubjectRef.current && func();
        })
      )
      .subscribe();

    propsSubjectRef.current.next({ func, loading, interval: intervalStr });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (propsSubjectRef.current) {
        propsSubjectRef.current.unsubscribe();
        propsSubjectRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = prevPropsRef.current;
    const current: Props = { func, loading, interval: intervalStr };

    if ((RefreshPicker.isLive(prev.interval) && RefreshPicker.isLive(current.interval)) || isEqual(prev, current)) {
      return;
    }

    propsSubjectRef.current && propsSubjectRef.current.next(current);
    prevPropsRef.current = current;
  }, [func, loading, intervalStr]);
  return null;
};
