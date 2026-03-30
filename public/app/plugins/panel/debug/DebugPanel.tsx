import { useRef } from 'react';
import { usePrevious } from 'react-use';

import { DataFrame, Field, PanelData, PanelProps } from '@grafana/data';

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

  // const prevSeries = usePrevious(props.data.series);

  // if (
  //   prevSeries != null &&
  //   prevSeries.length > 0 &&
  //   prevSeries !== props.data.series &&
  //   prevSeries[0].fields[0].values !== props.data.series[0].fields[0].values
  // ) {
  //   for (let i = 0; i < prevSeries.length; i++) {
  //     let fields = prevSeries[i].fields;

  //     for (let i = 0; i < fields.length; i++) {
  //       fields[i].values.length = 0;
  //     }
  //   }

  //   prevSeries.length = 0;
  // }

  useClearPreviousData(props.data);
}

function useClearPreviousData(data?: PanelData) {
  // this holds all value arrays from all series and anno frames
  // so we can empty any previous ones that no loger appear in current data
  // why? because React fiber: https://github.com/facebook/react/issues/14380
  const prevVals = useRef<Set<unknown[]>>();
  const currVals = useRef<Set<unknown[]>>();
  prevVals.current ??= new Set();
  currVals.current ??= new Set();

  // const prevFields = useRef<Set<Field>>();
  // const currFields = useRef<Set<Field>>();
  // prevFields.current ??= new Set();
  // currFields.current ??= new Set();

  // const prevFrames = useRef<Set<DataFrame>>();
  // const currFrames = useRef<Set<DataFrame>>();
  // prevFrames.current ??= new Set();
  // currFrames.current ??= new Set();

  const currSeries = data?.series;
  const prevSeries = usePrevious(currSeries);

  if (currSeries != null && currSeries !== prevSeries) {
    // populate new
    currVals.current.clear();
    // currFrames.current.clear();

    for (let i = 0; i < currSeries.length; i++) {
      let frame = currSeries[i];

      // currFrames.current.add(frame);

      for (let i = 0; i < frame.fields.length; i++) {
        let field = frame.fields[i];

        // currFields.current.add(field);

        currVals.current.add(field.values);
      }
    }

    // empty out all prev not seen in new
    // prevVals.current.difference(currVals.current);
    prevVals.current.forEach((vals) => {
      if (!currVals.current!.has(vals)) {
        vals.length = 0;
      }
    });
    prevVals.current.clear();
    prevVals.current = new Set(currVals.current);

    if (prevSeries != null) {
      for (let i = 0; i < prevSeries.length; i++) {
        let frame = prevSeries[i];

        frame.fields.length = 0;
        // TODO: clear nanos and enums on fields,
      }

      prevSeries.length = 0;
    }


    // prevFields.current.forEach((field) => {
    //   if (!currFields.current!.has(field)) {
    //     vals.length = 0;
    //   }
    // });

    // prevFrames.current.forEach((frame) => {
    //   if (!currFrames.current!.has(frame)) {
    //     // clear in parent, by index?
    //   }
    // });
    // prevFrames.current.clear();
    // prevFrames.current = new Set(currFrames.current);

    // prevSeries.length = 0;
  }

  // const prevAnnos = usePrevious(data.annotations);
}


/*
series and annos:

  series.length = 0;
  series[i].fields.length = 0;
  series[i].fields[i].values.length = 0;

  field nanos array, enum arrays
*/
