import moment from 'moment/moment';
import { HOURS, MINUTES_IN_HOUR, SECONDS_IN_DAY } from './Advanced.constants';
export const convertSecondsToDays = (dataRetention) => {
    const [count, units] = [+dataRetention.slice(0, -1), dataRetention.slice(-1)];
    switch (units) {
        case 'h':
            return count / HOURS;
        case 'm':
            return count / MINUTES_IN_HOUR;
        case 's':
            return count / SECONDS_IN_DAY;
        default:
            return '';
    }
};
export const convertSecondsStringToHour = (seconds) => moment.duration(parseInt(seconds, 10), 'seconds').asHours();
export const convertHoursStringToSeconds = (hours) => moment.duration(parseFloat(hours), 'hours').asSeconds();
export const convertCheckIntervalsToHours = (sttCheckIntervals) => {
    const { rareInterval: rawRareInterval, standardInterval: rawStandardInterval, frequentInterval: rawFrequentInterval, } = sttCheckIntervals;
    return {
        rareInterval: `${convertSecondsStringToHour(rawRareInterval)}`,
        standardInterval: `${convertSecondsStringToHour(rawStandardInterval)}`,
        frequentInterval: `${convertSecondsStringToHour(rawFrequentInterval)}`,
    };
};
const getPublicAddress = () => {
    return window.location.host || undefined;
};
export const dBaaSToggleOnChange = (event, input, mutators) => {
    input.onChange(event.target.checked);
    mutators.setPublicAddress(getPublicAddress());
};
//# sourceMappingURL=Advanced.utils.js.map