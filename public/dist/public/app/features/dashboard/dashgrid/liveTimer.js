import { BehaviorSubject } from 'rxjs';
import { dateMath, dateTime } from '@grafana/data';
// target is 20hz (50ms), but we poll at 100ms to smooth out jitter
const interval = 100;
class LiveTimer {
    constructor() {
        this.listeners = [];
        this.budget = 1;
        this.threshold = 1.5; // trial and error appears about right
        this.ok = new BehaviorSubject(true);
        this.lastUpdate = Date.now();
        this.isLive = false; // the dashboard time range ends in "now"
        this.liveTimeOffset = 0;
        // Called at the consistent dashboard interval
        this.measure = () => {
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
                let tr = undefined;
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
    /** Called when the dashboard time range changes */
    setLiveTimeRange(v) {
        var _a, _b, _c;
        this.timeRange = v;
        this.isLive = ((_a = v === null || v === void 0 ? void 0 : v.raw) === null || _a === void 0 ? void 0 : _a.to) === 'now';
        if (this.isLive) {
            const from = (_b = dateMath.parse(v.raw.from, false)) === null || _b === void 0 ? void 0 : _b.valueOf();
            const to = (_c = dateMath.parse(v.raw.to, true)) === null || _c === void 0 ? void 0 : _c.valueOf();
            this.liveTimeOffset = to - from;
            for (const listener of this.listeners) {
                listener.intervalMs = getLiveTimerInterval(this.liveTimeOffset, listener.panel.props.width);
            }
        }
    }
    listen(panel) {
        this.listeners.push({
            last: this.lastUpdate,
            panel: panel,
            intervalMs: getLiveTimerInterval(60000, // 1min
            panel.props.width),
        });
    }
    remove(panel) {
        this.listeners = this.listeners.filter((v) => v.panel !== panel);
    }
    updateInterval(panel) {
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
}
const FIVE_MINS = 5 * 60 * 1000;
export function getLiveTimerInterval(delta, width) {
    const millisPerPixel = Math.ceil(delta / width / 100) * 100;
    if (millisPerPixel > FIVE_MINS) {
        return FIVE_MINS;
    }
    return millisPerPixel;
}
export const liveTimer = new LiveTimer();
setInterval(liveTimer.measure, interval);
//# sourceMappingURL=liveTimer.js.map