import { EventBus, LegacyGraphHoverEvent, LegacyGraphHoverClearEvent } from '@grafana/data';
import { uPlotGlobalEvents } from '@grafana/ui/src/components/GraphNG/events';
import { PanelModel } from 'app/features/dashboard/state';
import React, { Component } from 'react';
import { Unsubscribable } from 'rxjs';

interface Props {
  eventBus: EventBus;
}

interface State {
  event?: any;
}
export class CursorView extends Component<Props, State> {
  subscriptions: Unsubscribable[] = [];
  state: State = {
    event: {
      pending: '...',
    },
  };

  componentDidMount() {
    this.subscriptions.push(
      uPlotGlobalEvents.observer.subscribe({
        next: (event) => {
          const pos: any = {
            panelRelY: event.y / event.h,
          };
          let values: any = {};
          for (const axis of event.src.axes) {
            const scale = event.src.scales[axis.scale!];
            if (scale && axis.scale) {
              const isX = axis.side === 0 || axis.side === 2; // Axis.Side.Bottom || axis.side === Axis.Side.Top;
              const value = event.src.posToVal(isX ? event.x : event.y, axis.scale);
              values[axis.scale] = value;
              if (isX) {
                pos.x = value;
              } else {
                pos.y = value;
              }
            }
          }

          // HACK: broadcast this to all flot panels
          this.props.eventBus.publish(new LegacyGraphHoverEvent({ pos, panel: { id: 123456 } }));

          if (true) {
            this.setState({
              event: {
                from: 'uplot',
                x: event.x,
                y: event.y,
                idx: event.dataIdx,
                values,
              },
            });
          }
        },
      })
    );

    const { eventBus } = this.props;

    this.subscriptions.push(
      eventBus.subscribe(LegacyGraphHoverEvent, (evt) => {
        // Our fake panel ID
        if (evt.payload.panel.id === 123456) {
          return; // ignore it!!! we posted it
        }

        const panel = evt.payload.panel as PanelModel;
        const yunit = panel.fieldConfig?.defaults?.unit ?? '__fixed';
        const { pos } = evt.payload;

        const values = {
          time: pos.x,
          [yunit]: pos.y,
        };
        uPlotGlobalEvents.publish(values);

        console.log('LegacyGraphHoverEvent', evt);
        this.setState({
          event: {
            from: 'legacy hover',
            type: evt.type,
            panelId: evt.payload.panel.id,
            values,
            pos,
          },
        });
      })
    );

    this.subscriptions.push(
      eventBus.subscribe(LegacyGraphHoverClearEvent, (evt) => {
        console.log('LegacyGraphHoverClearEvent', evt);
        // this.setState({
        //   event: {
        //     from: 'LegacyGraphHoverClearEvent',
        //   },
        // });
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
        <pre>{JSON.stringify(event, null, '  ')}</pre>
      </div>
    );
  }
}
