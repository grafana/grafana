import { usePrevious } from 'react-use';

import { PanelProps } from '@grafana/data';

// import { CursorView } from './CursorView';
// import { EventBusLoggerPanel } from './EventBusLogger';
// import { RenderInfoViewer } from './RenderInfoViewer';
// import { StateView } from './StateView';
import { Options, DebugMode } from './panelcfg.gen';

type Props = PanelProps<Options>;

export function DebugPanel(props: Props) {
  // const { options } = props;

  // switch (options.mode) {
  //   case DebugMode.Events:
  //     return <EventBusLoggerPanel eventBus={props.eventBus} />;
  //   case DebugMode.Cursor:
  //     return <CursorView eventBus={props.eventBus} />;
  //   case DebugMode.State:
  //     return <StateView {...props} />;
  //   case DebugMode.ThrowError:
  //     throw new Error('I failed you and for that i am deeply sorry');
  //   default:
  //     return <RenderInfoViewer {...props} />;
  // }

  const prevSeries = usePrevious(props.data.series);

  if (
    prevSeries != null &&
    prevSeries.length > 0 &&
    prevSeries !== props.data.series &&
    prevSeries[0].fields[0].values !== props.data.series[0].fields[0].values
  ) {
    for (let i = 0; i < prevSeries.length; i++) {
      let fields = prevSeries[i].fields;

      for (let i = 0; i < fields.length; i++) {
        fields[i].values.length = 0;
      }
    }

    prevSeries.length = 0;
  }
}
