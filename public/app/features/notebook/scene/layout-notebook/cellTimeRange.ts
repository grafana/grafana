import { type TimeOption } from '@grafana/data';
import {
  SceneObjectBase,
  SceneTimePicker,
  SceneTimeRange,
  type SceneObjectState,
  type SceneObjectUrlSyncHandler,
} from '@grafana/scenes';

import { type PanelKind } from '../../types';

class NotebookCellTimeRange extends SceneTimeRange {
  public get urlSync(): SceneObjectUrlSyncHandler | undefined {
    return undefined;
  }
}

export function buildCellSceneTimeRange(from: string, to: string, timeZone?: string): SceneTimeRange {
  return new NotebookCellTimeRange({ from, to, timeZone });
}

export interface CellTimeRangeSpec {
  from: string;
  to: string;
}

export function buildCellTimeRangeSpec(timeRange: SceneTimeRange): CellTimeRangeSpec {
  const { from, to } = timeRange.state;
  return { from, to };
}

export function withQueryOptionsTimeRange(element: PanelKind, range: CellTimeRangeSpec | undefined): PanelKind {
  return {
    ...element,
    spec: {
      ...element.spec,
      data: {
        ...element.spec.data,
        spec: {
          ...element.spec.data.spec,
          queryOptions: {
            ...element.spec.data.spec.queryOptions,
            timeFrom: range?.from,
            timeTo: range?.to,
          },
        },
      },
    },
  };
}

interface DraftTimeRangeHostState extends SceneObjectState {
  $timeRange: SceneTimeRange;
  // Rendered directly via timePicker.Component: resolves sceneGraph.getTimeRange(timePicker) to
  // $timeRange above, since SceneObjectBase auto-parents timePicker under this host.
  timePicker: SceneTimePicker;
}

/**
 * A scene-graph fragment used only inside the time-range popover, never attached to the notebook's
 * own tree
 */
export class DraftTimeRangeHost extends SceneObjectBase<DraftTimeRangeHostState> {}

export function buildDraftTimeRangeHost(
  from: string,
  to: string,
  timeZone: string,
  quickRanges?: TimeOption[]
): DraftTimeRangeHost {
  return new DraftTimeRangeHost({
    $timeRange: buildCellSceneTimeRange(from, to, timeZone),
    timePicker: new SceneTimePicker({ hideTimeSettings: true, quickRanges }),
  });
}
