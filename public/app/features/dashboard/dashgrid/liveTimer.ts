import { BehaviorSubject } from 'rxjs';

import { dateMath, dateTime, TimeRange } from '@grafana/data';

import { PanelStateWrapper } from './PanelStateWrapper';

// target is 20hz (50ms), but we poll at 100ms to smooth out jitter
const interval = 100;

interface LiveListener {
  last: number;
  intervalMs: number;
  panel: PanelStateWrapper;
}

class LiveTimer {
  listeners: LiveListener[] = [];

  budget = 1;
  threshold = 1.5; // trial and error appears about right
  ok = new BehaviorSubject(true);
  lastUpdate = Date.now();

  isLive = false; // the dashboard time range ends in "now"
  timeRange?: TimeRange;
  liveTimeOffset = 0;

  interval: NodeJS.Timeout;

  constructor() {
    this.interval = setInterval(this.measure, interval);
  }

  /** Called when the dashboard time range changes */
  setLiveTimeRange(v?: TimeRange) {
    this.timeRange = v;
    this.isLive = v?.raw?.to === 'now';

    if (this.isLive) {
      const from = dateMath.parse(v!.raw.from, false)?.valueOf()!;
      const to = dateMath.parse(v!.raw.to, true)?.valueOf()!;
      this.liveTimeOffset = to - from;

      for (const listener of this.listeners) {
        listener.intervalMs = getLiveTimerInterval(this.liveTimeOffset, listener.panel.props.width);
      }
    }
  }

  listen(panel: PanelStateWrapper) {
    // Prevent duplicate listeners for the same panel
    const existingIndex = this.listeners.findIndex(listener => listener.panel === panel);
    if (existingIndex !== -1) {
      return;
    }
    
    this.listeners.push({
      last: this.lastUpdate,
      panel: panel,
      intervalMs: getLiveTimerInterval(
        60000, // 1min
        panel.props.width
      ),
    });
  }

  remove(panel: PanelStateWrapper) {
    this.listeners = this.listeners.filter((v) => v.panel !== panel);
  }

  updateInterval(panel: PanelStateWrapper) {
    if (!this.timeRange || !this.isLive) {
      return;
    }
    for (const listener of this.listeners) {
      if (listener.panel === panel) {
        listener.intervalMs = getLiveTimerInterval(this.liveTimeOffset, listener.panel.props.width);
        return;
      }
    }
  }

  // Called at the consistent dashboard interval
  measure = () => {
    const now = Date.now();
    this.budget = (now - this.lastUpdate) / interval;

    const oldOk = this.ok.getValue();
    const newOk = this.budget <= this.threshold;
    if (oldOk !== newOk) {
      this.ok.next(newOk);
    }
    this.lastUpdate = now;

    // For live dashboards, listen to changes
    if (this.isLive && this.ok.getValue() && this.timeRange) {
      // when the time-range is relative fire events
      let tr: TimeRange | undefined = undefined;
      for (const listener of this.listeners) {
        if (!listener.panel.props.isInView) {
          continue;
        }

        const elapsed = now - listener.last;
        if (elapsed >= listener.intervalMs) {
          if (!tr) {
            const { raw } = this.timeRange;
            tr = {
              raw,
              from: dateTime(now - this.liveTimeOffset),
              to: dateTime(now),
            };
          }
          listener.panel.liveTimeChanged(tr);
          listener.last = now;
        }
      }
    }
  };
}

const FIVE_MINS = 5 * 60 * 1000;

export function getLiveTimerInterval(delta: number, width: number): number {
  const millisPerPixel = Math.ceil(delta / width / 100) * 100;
  if (millisPerPixel > FIVE_MINS) {
    return FIVE_MINS;
  }
  return millisPerPixel;
}

export const liveTimer = new LiveTimer();
