import { PureComponent } from 'react';
import { interval, Subscription, Subject, of, NEVER } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import _ from 'lodash';

import { stringToMs, SelectableValue } from '@grafana/data';
import { RefreshPicker } from '../RefreshPicker/RefreshPicker';

export function getIntervalFromString(strInterval: string): SelectableValue<number> {
  return {
    label: strInterval,
    value: stringToMs(strInterval),
  };
}

interface Props {
  func: () => any; // TODO
  loading: boolean;
  interval: string;
}

export class SetInterval extends PureComponent<Props> {
  private propsSubject: Subject<Props>;
  private subscription: Subscription | null;

  constructor(props: Props) {
    super(props);
    this.propsSubject = new Subject<Props>();
    this.subscription = null;
  }

  componentDidMount() {
    // Creating a subscription to propsSubject. This subject pushes values every time
    // SetInterval's props change
    this.subscription = this.propsSubject
      .pipe(
        // switchMap creates a new observables based on the input stream,
        // which becomes part of the propsSubject stream
        switchMap(props => {
          // If the query is live, empty value is emited. `of` creates single value,
          // which is merged to propsSubject stream
          if (RefreshPicker.isLive(props.interval)) {
            return of({});
          }

          // When query is loading, a new stream is merged. But it's a stream that emits no values(NEVER),
          // hence next call of this function will happen when query changes, and new props are passed into this component
          // When query is NOT loading, a new value is emited, this time it's an interval value,
          // which makes tap function below execute on that interval basis.
          return props.loading ? NEVER : interval(stringToMs(props.interval));
        }),
        // tap will execute function passed via func prop
        // * on value from `of` stream merged if query is live
        // * on specified interval (triggered by values emited by interval)
        tap(() => this.props.func())
      )
      .subscribe();

    // When component has mounted, propsSubject emits it's first value
    this.propsSubject.next(this.props);
  }

  componentDidUpdate(prevProps: Props) {
    if (
      (RefreshPicker.isLive(prevProps.interval) && RefreshPicker.isLive(this.props.interval)) ||
      _.isEqual(prevProps, this.props)
    ) {
      return;
    }
    // if props changed, a new value is emited from propsSubject
    this.propsSubject.next(this.props);
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    this.propsSubject.unsubscribe();
  }

  render(): null {
    return null;
  }
}
