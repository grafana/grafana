import { TimeRange } from '@grafana/data';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneTimeRangeState } from './types';

export class SceneTimeRange extends SceneObjectBase<SceneTimeRangeState> {
  onTimeRangeChange = (timeRange: TimeRange) => {
    this.setState(timeRange);
  };

  onRefresh = () => {
    // TODO re-eval time range
    this.setState({ ...this.state });
  };

  onIntervalChanged = (_: string) => {};
}
