import { FieldType, getTimeZoneInfo } from '@grafana/data';
import { calculateTimesWithin } from 'app/core/utils/timeRegions';
export function doTimeRegionQuery(name, config, range, tz) {
    var _a;
    if (!config) {
        return undefined;
    }
    const regions = calculateTimesWithin(config, range); // UTC
    if (!regions.length) {
        return undefined;
    }
    const times = [];
    const timesEnd = [];
    const texts = [];
    const regionTimezone = (_a = config.timezone) !== null && _a !== void 0 ? _a : tz;
    for (const region of regions) {
        let from = region.from;
        let to = region.to;
        const info = getTimeZoneInfo(regionTimezone, from);
        if (info) {
            const offset = info.offsetInMins * 60 * 1000;
            from += offset;
            to += offset;
        }
        times.push(from);
        timesEnd.push(to);
        texts.push(name);
    }
    return {
        fields: [
            { name: 'time', type: FieldType.time, values: times, config: {} },
            { name: 'timeEnd', type: FieldType.time, values: timesEnd, config: {} },
            { name: 'text', type: FieldType.string, values: texts, config: {} },
        ],
        length: times.length,
    };
}
//# sourceMappingURL=timeRegions.js.map