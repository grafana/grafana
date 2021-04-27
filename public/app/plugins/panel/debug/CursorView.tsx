import { getGlobalUPlotEvents, UPlotMouseEvent } from '@grafana/ui/src/components/GraphNG/events';
import React, { Component } from 'react';
import { Unsubscribable } from 'rxjs';

interface Props {
  // nothing
}

interface State {
  event?: UPlotMouseEvent;
}
export class CursorView extends Component<Props, State> {
  subscription?: Unsubscribable;
  state: State = {};

  componentDidMount() {
    this.subscription = getGlobalUPlotEvents().subscribe({
      next: (event) => {
        this.setState({ event });
      },
    });
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  render() {
    const { event } = this.state;
    if (!event) {
      return <div>no events yet</div>;
    }
    return (
      <div>
        X: {event.x}
        <br />
        Y: {event.y}
        <br />
        IDX: {event.dataIdx}
        <br />
      </div>
    );
  }
}
