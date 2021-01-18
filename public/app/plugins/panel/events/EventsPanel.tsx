// Libraries
import React, { PureComponent } from 'react';

// Utils & Services
import { CustomScrollbar } from '@grafana/ui';

// Types
import {
  PanelProps,
  BusEvent,
  CircularVector,
  DataHoverPayload,
  DataHoverEvent,
  DataHoverClearEvent,
  DataSelectEvent,
} from '@grafana/data';
import { EventsPanelOptions } from './types';
import { PartialObserver } from 'rxjs';

interface Props extends PanelProps<EventsPanelOptions> {}

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

export class EventsPanel extends PureComponent<Props, State> {
  history = new CircularVector<BusEventEx>({ capacity: 40, append: 'head' });

  constructor(props: Props) {
    super(props);

    this.state = { counter };

    props.eventBus.getStream(DataHoverEvent).subscribe(this.eventObserver);
    props.eventBus.getStream(DataHoverClearEvent).subscribe(this.eventObserver);
    props.eventBus.getStream(DataSelectEvent).subscribe(this.eventObserver);
  }

  eventObserver: PartialObserver<BusEvent> = {
    next: (v: BusEvent) => {
      this.history.add({
        key: counter++,
        type: v.type,
        payload: v.payload,
      });
      this.setState({ counter });
    },
  };

  render() {
    return (
      <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
        {this.history.map((v, idx) => (
          <div key={v.key}>
            {v.key} / X:{JSON.stringify(v.payload.x)} / Y:{JSON.stringify(v.payload.y)}
          </div>
        ))}
      </CustomScrollbar>
    );
  }
}

// const getStyles = stylesFactory((theme: GrafanaTheme) => ({
//   container: css`
//     height: 100%;
//   `,
//   item: css`
//     padding: ${theme.spacing.sm};
//     position: relative;
//     margin-bottom: 4px;
//     margin-right: ${theme.spacing.sm};
//     border-bottom: 2px solid ${theme.colors.border1};
//   `,
//   link: css`
//     color: ${theme.colors.linkExternal};

//     &:hover {
//       color: ${theme.colors.linkExternal};
//       text-decoration: underline;
//     }
//   `,
//   title: css`
//     max-width: calc(100% - 70px);
//     font-size: 16px;
//     margin-bottom: ${theme.spacing.sm};
//   `,
//   content: css`
//     p {
//       margin-bottom: 4px;
//       color: ${theme.colors.text};
//     }
//   `,
//   date: css`
//     position: absolute;
//     top: 0;
//     right: 0;
//     background: ${theme.colors.panelBg};
//     width: 55px;
//     text-align: right;
//     padding: ${theme.spacing.xs};
//     font-weight: 500;
//     border-radius: 0 0 0 3px;
//     color: ${theme.colors.textWeak};
//   `,
// }));
