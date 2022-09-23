import { dateMath, getDefaultTimeRange, TimeRange, UrlQueryMap } from '@grafana/data';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneObjectWithUrlSync, SceneTimeRangeState } from './types';

export class SceneTimeRange extends SceneObjectBase<SceneTimeRangeState> implements SceneObjectWithUrlSync {
  constructor(state: SceneTimeRangeState = { range: getDefaultTimeRange() }) {
    super({
      ...state,
      range: state.range
        ? {
            // TODO: add timezone and fiscal year support
            from: dateMath.parse(state.range.from, false)!,
            to: dateMath.parse(state.range.to, false)!,
            raw: state.range.raw
              ? state.range.raw
              : {
                  from: state.range.from,
                  to: state.range.to,
                },
          }
        : getDefaultTimeRange(),
    });
  }

  onTimeRangeChange = (range: TimeRange) => {
    this.setState({ range });
  };

  onRefresh = () => {
    // TODO re-eval time range
    this.setState({ ...this.state });
  };

  onIntervalChanged = (_: string) => {};

  /** These url sync functions are only placeholders for something more sophisticated  */
  getUrlState() {
    return {
      from: this.state.range.raw.from,
      to: this.state.range.raw.to,
    } as any;
  }

  updateFromUrl(values: UrlQueryMap) {
    // TODO
  }
}
