import { omitBy, isUndefined } from 'lodash';
export const DAYS_OF_THE_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const MONTHS = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
];
export const defaultTimeInterval = {
    times: [{ start_time: '', end_time: '' }],
    weekdays: '',
    days_of_month: '',
    months: '',
    years: '',
    location: '',
};
export const validateArrayField = (value, validateValue, invalidText) => {
    if (value) {
        return (value
            .split(',')
            .map((x) => x.trim())
            .every((entry) => entry.split(':').every(validateValue)) || invalidText);
    }
    else {
        return true;
    }
};
const convertStringToArray = (str) => {
    return str ? str.split(',').map((s) => s.trim()) : undefined;
};
export const createMuteTiming = (fields) => {
    const timeIntervals = fields.time_intervals.map(({ times, weekdays, days_of_month, months, years, location }) => {
        var _a;
        const interval = {
            times: times.filter(({ start_time, end_time }) => !!start_time && !!end_time),
            weekdays: (_a = convertStringToArray(weekdays)) === null || _a === void 0 ? void 0 : _a.map((v) => v.toLowerCase()),
            days_of_month: convertStringToArray(days_of_month),
            months: convertStringToArray(months),
            years: convertStringToArray(years),
            location: location ? location : undefined,
        };
        return omitBy(interval, isUndefined);
    });
    return {
        name: fields.name,
        time_intervals: timeIntervals,
    };
};
//# sourceMappingURL=mute-timings.js.map