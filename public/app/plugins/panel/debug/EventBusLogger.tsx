import { PureComponent } from 'react';
import { PartialObserver, Unsubscribable } from 'rxjs';

import {
  BusEvent,
  CircularVector,
  DataHoverEvent,
  DataHoverClearEvent,
  DataSelectEvent,
  EventBus,
} from '@grafana/data';
import { CustomScrollbar } from '@grafana/ui';

interface Props {
  eventBus: EventBus;
}

interface State {
  isError?: boolean;
  counter: number;
}

interface BusEventEx {
  key: number;
  type: string;
  path: string;
  payload: any;
}
let counter = 100;

export class EventBusLoggerPanel extends PureComponent<Props, State> {
  history = new CircularVector<BusEventEx>({ capacity: 40, append: 'head' });
  subs: Unsubscribable[];

  constructor(props: Props) {
    super(props);

    this.state = { counter };

    const subs: Unsubscribable[] = [];
    subs.push(props.eventBus.getStream(DataHoverEvent).subscribe(this.eventObserver));
    subs.push(props.eventBus.getStream(DataHoverClearEvent).subscribe(this.eventObserver));
    subs.push(props.eventBus.getStream(DataSelectEvent).subscribe(this.eventObserver));
    this.subs = subs;
  }

  componentWillUnmount() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

  eventObserver: PartialObserver<BusEvent> = {
    next: (event: BusEvent) => {
      const origin: any = event.origin;
      this.history.add({
        key: counter++,
        type: event.type,
        path: origin?.path,
        payload: event.payload,
      });
      this.setState({ counter });
    },
  };

  render() {
    return (
      <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
        {this.history.map((v, idx) => (
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          <div key={v.key}>
            {JSON.stringify(v.path)} {v.type} / X:{JSON.stringify(v.payload.x)} / Y:{JSON.stringify(v.payload.y)}
          </div>
        ))}
      </CustomScrollbar>
    );
  }
}
