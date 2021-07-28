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
import { Subscription } from 'rxjs';

interface Props {
  eventBus: EventBus;
}

interface State {
  event?: BusEventWithPayload<DataHoverPayload>;
}
export class CursorView extends Component<Props, State> {
  subscription = new Subscription();
  state: State = {};

  componentDidMount() {
    const { eventBus } = this.props;

    this.subscription.add(
      eventBus.subscribe(DataHoverEvent, (event) => {
        this.setState({ event });
      })
    );

    this.subscription.add(
      eventBus.subscribe(DataHoverClearEvent, (event) => {
        this.setState({ event });
      })
    );

    this.subscription.add(
      eventBus.subscribe(LegacyGraphHoverEvent, (event) => {
        this.setState({ event });
      })
    );

    this.subscription.add(
      eventBus.subscribe(LegacyGraphHoverClearEvent, (event) => {
        this.setState({ event });
      })
    );
  }

  componentWillUnmount() {
    this.subscription.unsubscribe();
  }

  render() {
    const { event } = this.state;
    if (!event) {
      return <div>no events yet</div>;
    }
    const { type, payload, origin } = event;
    return (
      <div>
        <h3>Origin: {(origin as any)?.path}</h3>
        <span>Type: {type}</span>
        <pre>{JSON.stringify(payload.point, null, '  ')}</pre>
        {payload.data && (
          <div>
            Row: {payload.rowIndex} / Column: {payload.columnIndex}
          </div>
        )}
      </div>
    );
  }
}
