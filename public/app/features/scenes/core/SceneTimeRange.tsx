import { dateMath, getDefaultTimeRange } from '@grafana/data';

import { SceneTimeRangeObject } from './SceneObjectBase';
import { SceneTimeRangeState } from './types';

export class SceneTimeRange extends SceneTimeRangeObject {
  constructor(state: SceneTimeRangeState) {
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

  toJSON() {
    return {
      range: {
        from: this.state.range?.raw.from,
        to: this.state.range?.raw.to,
      },
    };
  }
}
