import { dateTime } from '@grafana/data';
export function calculateTimesWithin(cfg, tRange) {
    var _a, _b;
    if (!(cfg.fromDayOfWeek || cfg.from) && !(cfg.toDayOfWeek || cfg.to)) {
        return [];
    }
    // So we can mutate
    const timeRegion = Object.assign({}, cfg);
    if (timeRegion.from && !timeRegion.to) {
        timeRegion.to = timeRegion.from;
    }
    if (!timeRegion.from && timeRegion.to) {
        timeRegion.from = timeRegion.to;
    }
    const hRange = {
        from: parseTimeOfDay(timeRegion.from),
        to: parseTimeOfDay(timeRegion.to),
    };
    if (!timeRegion.fromDayOfWeek && timeRegion.toDayOfWeek) {
        timeRegion.fromDayOfWeek = timeRegion.toDayOfWeek;
    }
    if (!timeRegion.toDayOfWeek && timeRegion.fromDayOfWeek) {
        timeRegion.toDayOfWeek = timeRegion.fromDayOfWeek;
    }
    if (timeRegion.fromDayOfWeek) {
        hRange.from.dayOfWeek = Number(timeRegion.fromDayOfWeek);
    }
    if (timeRegion.toDayOfWeek) {
        hRange.to.dayOfWeek = Number(timeRegion.toDayOfWeek);
    }
    if (hRange.from.dayOfWeek && hRange.from.h == null && hRange.from.m == null) {
        hRange.from.h = 0;
        hRange.from.m = 0;
        hRange.from.s = 0;
    }
    if (hRange.to.dayOfWeek && hRange.to.h == null && hRange.to.m == null) {
        hRange.to.h = 23;
        hRange.to.m = 59;
        hRange.to.s = 59;
    }
    if (!hRange.from || !hRange.to) {
        return [];
    }
    if (hRange.from.h == null) {
        hRange.from.h = 0;
    }
    if (hRange.to.h == null) {
        hRange.to.h = 23;
    }
    const regions = [];
    const fromStart = dateTime(tRange.from).utc();
    fromStart.set('hour', 0);
    fromStart.set('minute', 0);
    fromStart.set('second', 0);
    fromStart.set('millisecond', 0);
    fromStart.add(hRange.from.h, 'hours');
    fromStart.add(hRange.from.m, 'minutes');
    fromStart.add(hRange.from.s, 'seconds');
    while (fromStart.unix() <= tRange.to.unix()) {
        while (hRange.from.dayOfWeek && hRange.from.dayOfWeek !== fromStart.isoWeekday()) {
            fromStart.add(24, 'hours');
        }
        if (fromStart.unix() > tRange.to.unix()) {
            break;
        }
        const fromEnd = dateTime(fromStart).utc();
        if (fromEnd.hour) {
            if (hRange.from.h <= hRange.to.h) {
                fromEnd.add(hRange.to.h - hRange.from.h, 'hours');
            }
            else if (hRange.from.h > hRange.to.h) {
                while (fromEnd.hour() !== hRange.to.h) {
                    fromEnd.add(1, 'hours');
                }
            }
            else {
                fromEnd.add(24 - hRange.from.h, 'hours');
                while (fromEnd.hour() !== hRange.to.h) {
                    fromEnd.add(1, 'hours');
                }
            }
        }
        fromEnd.set('minute', (_a = hRange.to.m) !== null && _a !== void 0 ? _a : 0);
        fromEnd.set('second', (_b = hRange.to.s) !== null && _b !== void 0 ? _b : 0);
        while (hRange.to.dayOfWeek && hRange.to.dayOfWeek !== fromEnd.isoWeekday()) {
            fromEnd.add(24, 'hours');
        }
        const outsideRange = (fromStart.unix() < tRange.from.unix() && fromEnd.unix() < tRange.from.unix()) ||
            (fromStart.unix() > tRange.to.unix() && fromEnd.unix() > tRange.to.unix());
        if (!outsideRange) {
            regions.push({ from: fromStart.valueOf(), to: fromEnd.valueOf() });
        }
        fromStart.add(24, 'hours');
    }
    return regions;
}
export function parseTimeOfDay(str) {
    const result = {};
    if (!(str === null || str === void 0 ? void 0 : str.length)) {
        return result;
    }
    const match = str.split(':');
    if (!(match === null || match === void 0 ? void 0 : match.length)) {
        return result;
    }
    result.h = Math.min(23, Math.max(0, Number(match[0])));
    if (match.length > 1) {
        result.m = Math.min(60, Math.max(0, Number(match[1])));
        if (match.length > 2) {
            result.s = Math.min(60, Math.max(0, Number(match[2])));
        }
    }
    return result;
}
export function formatTimeOfDayString(t) {
    var _a, _b, _c;
    if (!t || (t.h == null && t.m == null && t.s == null)) {
        return '';
    }
    let str = String((_a = t.h) !== null && _a !== void 0 ? _a : 0).padStart(2, '0') + ':' + String((_b = t.m) !== null && _b !== void 0 ? _b : 0).padStart(2, '0');
    if (t.s != null) {
        str += String((_c = t.s) !== null && _c !== void 0 ? _c : 0).padStart(2, '0');
    }
    return str;
}
//# sourceMappingURL=timeRegions.js.map