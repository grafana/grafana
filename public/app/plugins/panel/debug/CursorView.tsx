import React, { Component } from 'react';
import { Subscription } from 'rxjs';

import {
  EventBus,
  LegacyGraphHoverEvent,
  LegacyGraphHoverClearEvent,
  DataHoverEvent,
  DataHoverClearEvent,
  BusEventBase,
} from '@grafana/data';
import { CustomScrollbar } from '@grafana/ui';
import { DataHoverView } from 'app/features/visualization/data-hover/DataHoverView';

interface Props {
  eventBus: EventBus;
}

interface State {
  event?: BusEventBase;
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
      <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
        <h3>Origin: {(origin as any)?.path}</h3>
        <span>Type: {type}</span>
        {Boolean(payload) && (
          <>
            <pre>{JSON.stringify(payload.point, null, '  ')}</pre>
            {payload.data && (
              <DataHoverView data={payload.data} rowIndex={payload.rowIndex} columnIndex={payload.columnIndex} />
            )}
          </>
        )}
      </CustomScrollbar>
    );
  }
}
