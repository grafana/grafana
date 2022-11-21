import { getDefaultTimeRange, getTimeZone, TimeRange, UrlQueryMap } from '@grafana/data';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneObjectWithUrlSync, SceneTimeRangeState } from './types';

export class SceneTimeRange extends SceneObjectBase<SceneTimeRangeState> implements SceneObjectWithUrlSync {
  public constructor(state: Partial<SceneTimeRangeState> = {}) {
    super({
      ...getDefaultTimeRange(),
      timeZone: getTimeZone(),
      ...state,
    });
  }

  public onTimeRangeChange = (timeRange: TimeRange) => {
    this.setState(timeRange);
  };

  public onRefresh = () => {
    // TODO re-eval time range
    this.setState({ ...this.state });
  };

  public onIntervalChanged = (_: string) => {};

  /** These url sync functions are only placeholders for something more sophisticated  */
  public getUrlState() {
    return {
      from: this.state.raw.from,
      to: this.state.raw.to,
    } as any;
  }

  public updateFromUrl(values: UrlQueryMap) {
    // TODO
  }
}
