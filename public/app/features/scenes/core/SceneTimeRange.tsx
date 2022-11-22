import { getDefaultTimeRange, getTimeZone, isDateTime, TimeRange, toUtc, UrlQueryValue } from '@grafana/data';

import { SceneObjectUrlSyncConfig } from '../services/SceneObjectUrlSyncConfig';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneTimeRangeState } from './types';

export class SceneTimeRange extends SceneObjectBase<SceneTimeRangeState> {
  protected _urlSync = new SceneObjectUrlSyncConfig({
    keys: ['from', 'to'],
    toUrlValues: () => this.toUrlValues(),
    fromUrlValues: (values) => this.fromUrlValues(values),
  });

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

  private toUrlValues() {
    const range = { ...this.state.raw };

    if (isDateTime(range.from)) {
      range.from = range.from.valueOf().toString();
    }
    if (isDateTime(range.to)) {
      range.to = range.to.valueOf().toString();
    }

    return new Map<string, UrlQueryValue>([
      ['from', range.from],
      ['to', range.to],
    ]);
  }

  private fromUrlValues(values: Map<string, UrlQueryValue>) {
    const update: Partial<SceneTimeRangeState> = {};

    if (values.has('from')) {
      const from = parseUrlParam(values.get('from'));
      update.raw = { ...this.state.raw, from: toUtc(from) };
    }
  }
}

function parseUrlParam(value: UrlQueryValue) {
  if (typeof value !== 'string') {
    return null;
  }

  if (value.indexOf('now') !== -1) {
    return value;
  }

  if (value.length === 8) {
    const utcValue = toUtc(value, 'YYYYMMDD');
    if (utcValue.isValid()) {
      return utcValue;
    }
  } else if (value.length === 15) {
    const utcValue = toUtc(value, 'YYYYMMDDTHHmmss');
    if (utcValue.isValid()) {
      return utcValue;
    }
  }

  const epoch = parseInt(value, 10);
  if (!isNaN(epoch)) {
    return toUtc(epoch);
  }

  return null;
}
