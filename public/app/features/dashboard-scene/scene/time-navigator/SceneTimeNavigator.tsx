import { useMeasure } from 'react-use';

import { dateTime } from '@grafana/data';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectState, sceneGraph } from '@grafana/scenes';

import { TimeBar } from './TimeBar';
import { CONTEXT_ZOOM_FACTOR, type TimeRangeMs } from './timeModel';

const EMPTY: number[] = [];

export interface SceneTimeNavigatorState extends SceneObjectState {
  /** Rendered height of the control, in px. */
  height?: number;
  /** How many times wider than the selection the initial/reset context window is. */
  contextZoomFactor?: number;
}

/**
 * A dashboard control that renders the timebar (a zoomed-out context window with a brushed selection that
 * drives the dashboard time range). It participates in the scene graph: it reads and writes the shared
 * time range via `sceneGraph.getTimeRange(this)`, so it stays in sync with the time picker and URL, and
 * preserves relative ranges (`now-6h`) on read. The visual/interaction logic lives in the shared
 * framework-agnostic `<TimeBar>` component (the same one the timebar panel plugin uses).
 */
export class SceneTimeNavigator extends SceneObjectBase<SceneTimeNavigatorState> {
  public static Component = SceneTimeNavigatorRenderer;
}

function SceneTimeNavigatorRenderer({ model }: SceneComponentProps<SceneTimeNavigator>) {
  const { height = 88, contextZoomFactor = CONTEXT_ZOOM_FACTOR } = model.useState();
  // Subscribing to the shared time range re-renders this control whenever the range changes elsewhere.
  const { value } = sceneGraph.getTimeRange(model).useState();
  // Measure the actual row width so uPlot and the selection overlay share the exact same basis.
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  const onChangeTimeRange = (range: TimeRangeMs) => {
    // A brushed selection is inherently absolute; SceneTimeRange stores DateTime raw as an ISO string.
    const from = dateTime(range.from);
    const to = dateTime(range.to);
    sceneGraph.getTimeRange(model).onTimeRangeChange({ from, to, raw: { from, to } });
  };

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {width > 0 && (
        <TimeBar
          value={{ from: value.from.valueOf(), to: value.to.valueOf() }}
          now={Date.now()}
          width={width}
          height={height}
          time={EMPTY}
          values={EMPTY}
          contextZoomFactor={contextZoomFactor}
          onChangeTimeRange={onChangeTimeRange}
        />
      )}
    </div>
  );
}
