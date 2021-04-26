import React, { PureComponent } from 'react';
import { CustomScrollbar } from '@grafana/ui';
import {
  BusEvent,
  CircularVector,
  DataHoverPayload,
  DataHoverEvent,
  DataHoverClearEvent,
  DataSelectEvent,
  EventBus,
  BusEventHandler,
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
  payload: DataHoverPayload;
}
let counter = 100;

export class EventBusLoggerPanel extends PureComponent<Props, State> {
  history = new CircularVector<BusEventEx>({ capacity: 40, append: 'head' });
  subs: Unsubscribable[] = [];

  constructor(props: Props) {
    super(props);

    this.state = { counter };

    this.subs.push(props.eventBus.subscribe(DataHoverEvent, this.hoverHandler));
    props.eventBus.getStream(DataHoverClearEvent).subscribe(this.eventObserver);
    props.eventBus.getStream(DataSelectEvent).subscribe(this.eventObserver);
  }

  componentWillUnmount() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

  hoverHandler: BusEventHandler<DataHoverEvent> = (event: DataHoverEvent) => {
    this.history.add({
      key: counter++,
      type: event.type,
      payload: event.payload,
    });
    this.setState({ counter });
  };

  eventObserver: PartialObserver<BusEvent> = {
    next: (v: BusEvent) => {},
  };

  render() {
    return (
      <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
        {this.history.map((v, idx) => (
          <div key={v.key}>
            {v.key} {v.type} / X:{JSON.stringify(v.payload.x)} / Y:{JSON.stringify(v.payload.y)}
          </div>
        ))}
      </CustomScrollbar>
    );
  }
}
