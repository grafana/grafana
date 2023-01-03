import { dateMath, getTimeZone, TimeRange, TimeZone } from '@grafana/data';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneTimeRangeLike, SceneTimeRangeState } from '../core/types';

export interface PanelTimeRangeState extends SceneTimeRangeState {
  timeShift?: string;
}

export class PanelTimeRange extends SceneObjectBase<PanelTimeRangeState> implements SceneTimeRangeLike {
  public constructor(state: Partial<SceneTimeRangeState> = {}) {
    const from = state.from ?? 'now-6h';
    const to = state.to ?? 'now';
    const timeZone = state.timeZone ?? getTimeZone();
    const value = evaluateTimeRange(from, to, timeZone);
    super({ from, to, timeZone, value, ...state });
  }

  public activate(): void {
    super.activate();

    if (this.state.timeShift) {
      // subscribe to parent time etc and perform time shift
    }
  }

  public onTimeRangeChange = (timeRange: TimeRange) => {
    const update: Partial<SceneTimeRangeState> = {};

    if (typeof timeRange.raw.from === 'string') {
      update.from = timeRange.raw.from;
    } else {
      update.from = timeRange.raw.from.toISOString();
    }

    if (typeof timeRange.raw.to === 'string') {
      update.to = timeRange.raw.to;
    } else {
      update.to = timeRange.raw.to.toISOString();
    }

    update.value = evaluateTimeRange(update.from, update.to, this.state.timeZone);
    this.setState(update);
  };

  public onRefresh = () => {
    this.setState({ value: evaluateTimeRange(this.state.from, this.state.to, this.state.timeZone) });
  };

  public onIntervalChanged = (_: string) => {};
}

function evaluateTimeRange(from: string, to: string, timeZone: TimeZone, fiscalYearStartMonth?: number): TimeRange {
  return {
    from: dateMath.parse(from, false, timeZone, fiscalYearStartMonth)!,
    to: dateMath.parse(to, true, timeZone, fiscalYearStartMonth)!,
    raw: {
      from: from,
      to: to,
    },
  };
}
