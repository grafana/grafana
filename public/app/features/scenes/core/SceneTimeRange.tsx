import { TimeRange, UrlQueryMap } from '@grafana/data';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneObjectWithUrlSync, SceneTimeRangeState } from './types';

export class SceneTimeRange extends SceneObjectBase<SceneTimeRangeState> implements SceneObjectWithUrlSync {
  onTimeRangeChange = (timeRange: TimeRange) => {
    this.setState(timeRange);
  };

  onRefresh = () => {
    // TODO re-eval time range
    this.setState({ ...this.state });
  };

  onIntervalChanged = (_: string) => {};

  /** These url sync functions are only placeholders for something more sophisticated  */
  getUrlState() {
    return {
      from: this.state.raw.from,
      to: this.state.raw.to,
    } as any;
  }

  updateFromUrl(values: UrlQueryMap) {
    // TODO
  }
}
