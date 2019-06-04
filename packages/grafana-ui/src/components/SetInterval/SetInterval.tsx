import { PureComponent } from 'react';
import { interval, Subscription, Subject, of, NEVER } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import _ from 'lodash';

import { stringToMs } from '@grafana/data';
import { isLive } from '../RefreshPicker/RefreshPicker';
import { SelectOptionItem } from '../Select/Select';

export function getIntervalFromString(strInterval: string): SelectOptionItem<number> {
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
    this.subscription = this.propsSubject
      .pipe(
        switchMap(props => {
          if (isLive(props.interval)) {
            return of({});
          }
          return props.loading ? NEVER : interval(stringToMs(props.interval));
        }),
        tap(() => this.props.func())
      )
      .subscribe();
    this.propsSubject.next(this.props);
  }

  componentDidUpdate(prevProps: Props) {
    if ((isLive(prevProps.interval) && isLive(this.props.interval)) || _.isEqual(prevProps, this.props)) {
      return;
    }

    this.propsSubject.next(this.props);
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    this.propsSubject.unsubscribe();
  }

  render() {
    return null;
  }
}
