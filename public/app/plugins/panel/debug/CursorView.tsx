import {
  EventBus,
  LegacyGraphHoverEvent,
  LegacyGraphHoverClearEvent,
  DataHoverEvent,
  DataHoverClearEvent,
  DataHoverPayload,
  BusEventWithPayload,
} from '@grafana/data';
import React, { Component } from 'react';
import { Unsubscribable } from 'rxjs';

interface Props {
  eventBus: EventBus;
}

interface State {
  event?: BusEventWithPayload<DataHoverPayload>;
}
export class CursorView extends Component<Props, State> {
  subscriptions: Unsubscribable[] = [];
  state: State = {};

  componentDidMount() {
    const { eventBus } = this.props;

    this.subscriptions.push(
      eventBus.subscribe(DataHoverEvent, (event) => {
        this.setState({ event });
      })
    );

    this.subscriptions.push(
      eventBus.subscribe(DataHoverClearEvent, (event) => {
        this.setState({ event });
      })
    );

    this.subscriptions.push(
      eventBus.subscribe(LegacyGraphHoverEvent, (event) => {
        this.setState({ event });
      })
    );

    this.subscriptions.push(
      eventBus.subscribe(LegacyGraphHoverClearEvent, (event) => {
        this.setState({ event });
      })
    );
  }

  componentWillUnmount() {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }

  render() {
    const { event } = this.state;
    if (!event) {
      return <div>no events yet</div>;
    }
    return (
      <div>
        <h2>Origin: {(event.origin as any)?.path}</h2>
        <span>Type: {event.type}</span>
        <pre>{JSON.stringify(event.payload.point, null, '  ')}</pre>
      </div>
    );
  }
}
