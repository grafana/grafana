import { __values } from "tslib";
import { dateMath, dateTime } from '@grafana/data';
// target is 20hz (50ms), but we poll at 100ms to smooth out jitter
var interval = 100;
var LiveTimer = /** @class */ (function () {
    function LiveTimer() {
        var _this = this;
        this.listeners = [];
        this.budget = 1;
        this.threshold = 1.5; // trial and error appears about right
        this.ok = true;
        this.lastUpdate = Date.now();
        this.isLive = false; // the dashboard time range ends in "now"
        this.liveTimeOffset = 0;
        // Called at the consistent dashboard interval
        this.measure = function () {
            var e_1, _a;
            var now = Date.now();
            _this.budget = (now - _this.lastUpdate) / interval;
            _this.ok = _this.budget <= _this.threshold;
            _this.lastUpdate = now;
            // For live dashboards, listen to changes
            if (_this.ok && _this.isLive && _this.timeRange) {
                // when the time-range is relative fire events
                var tr = undefined;
                try {
                    for (var _b = __values(_this.listeners), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var listener = _c.value;
                        if (!listener.panel.props.isInView) {
                            continue;
                        }
                        var elapsed = now - listener.last;
                        if (elapsed >= listener.intervalMs) {
                            if (!tr) {
                                var raw = _this.timeRange.raw;
                                tr = {
                                    raw: raw,
                                    from: dateTime(now - _this.liveTimeOffset),
                                    to: dateTime(now),
                                };
                            }
                            listener.panel.liveTimeChanged(tr);
                            listener.last = now;
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
        };
    }
    /** Called when the dashboard time range changes */
    LiveTimer.prototype.setLiveTimeRange = function (v) {
        var e_2, _a;
        var _b, _c, _d;
        this.timeRange = v;
        this.isLive = ((_b = v === null || v === void 0 ? void 0 : v.raw) === null || _b === void 0 ? void 0 : _b.to) === 'now';
        if (this.isLive) {
            var from = (_c = dateMath.parse(v.raw.from, false)) === null || _c === void 0 ? void 0 : _c.valueOf();
            var to = (_d = dateMath.parse(v.raw.to, true)) === null || _d === void 0 ? void 0 : _d.valueOf();
            this.liveTimeOffset = to - from;
            try {
                for (var _e = __values(this.listeners), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var listener = _f.value;
                    listener.intervalMs = getLiveTimerInterval(this.liveTimeOffset, listener.panel.props.width);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    };
    LiveTimer.prototype.listen = function (panel) {
        this.listeners.push({
            last: this.lastUpdate,
            panel: panel,
            intervalMs: getLiveTimerInterval(60000, // 1min
            panel.props.width),
        });
    };
    LiveTimer.prototype.remove = function (panel) {
        this.listeners = this.listeners.filter(function (v) { return v.panel !== panel; });
    };
    LiveTimer.prototype.updateInterval = function (panel) {
        var e_3, _a;
        if (!this.timeRange || !this.isLive) {
            return;
        }
        try {
            for (var _b = __values(this.listeners), _c = _b.next(); !_c.done; _c = _b.next()) {
                var listener = _c.value;
                if (listener.panel === panel) {
                    listener.intervalMs = getLiveTimerInterval(this.liveTimeOffset, listener.panel.props.width);
                    return;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    return LiveTimer;
}());
var FIVE_MINS = 5 * 60 * 1000;
export function getLiveTimerInterval(delta, width) {
    var millisPerPixel = Math.ceil(delta / width / 100) * 100;
    if (millisPerPixel > FIVE_MINS) {
        return FIVE_MINS;
    }
    return millisPerPixel;
}
export var liveTimer = new LiveTimer();
setInterval(liveTimer.measure, interval);
//# sourceMappingURL=liveTimer.js.map