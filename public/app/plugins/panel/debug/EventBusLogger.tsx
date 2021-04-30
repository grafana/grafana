import React, { PureComponent } from 'react';
import { CustomScrollbar } from '@grafana/ui';
import {
  BusEvent,
  CircularVector,
  DataHoverEvent,
  DataHoverClearEvent,
  DataSelectEvent,
  EventBus,
} from '@grafana/data';
import { PartialObserver, Unsubscribable } from 'rxjs';

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
  subs: Unsubscribable[] = [];

  constructor(props: Props) {
    super(props);

    this.state = { counter };

    props.eventBus.getStream(DataHoverEvent).subscribe(this.eventObserver);
    props.eventBus.getStream(DataHoverClearEvent).subscribe(this.eventObserver);
    props.eventBus.getStream(DataSelectEvent).subscribe(this.eventObserver);
  }

  componentWillUnmount() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

  eventObserver: PartialObserver<BusEvent> = {
    next: (event: BusEvent) => {
      const origin = event.origin as any;
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
          <div key={v.key}>
            {JSON.stringify(v.path)} {v.type} / X:{JSON.stringify(v.payload.x)} / Y:{JSON.stringify(v.payload.y)}
          </div>
        ))}
      </CustomScrollbar>
    );
  }
}
