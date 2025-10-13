import moment from 'moment/moment';

import { AdvisorRunIntervalsSettings } from 'app/percona/settings/Settings.types';

import { HOURS, MINUTES_IN_HOUR, SECONDS_IN_DAY } from './Advanced.constants';

export const convertSecondsToDays = (dataRetention: string) => {
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

export const convertSecondsStringToHour = (seconds: string) =>
  moment.duration(parseInt(seconds, 10), 'seconds').asHours();

export const convertHoursStringToSeconds = (hours: string) => moment.duration(parseFloat(hours), 'hours').asSeconds();

export const convertCheckIntervalsToHours = (sttCheckIntervals: AdvisorRunIntervalsSettings) => {
  const {
    rareInterval: rawRareInterval,
    standardInterval: rawStandardInterval,
    frequentInterval: rawFrequentInterval,
  } = sttCheckIntervals;
  return {
    rareInterval: `${convertSecondsStringToHour(rawRareInterval)}`,
    standardInterval: `${convertSecondsStringToHour(rawStandardInterval)}`,
    frequentInterval: `${convertSecondsStringToHour(rawFrequentInterval)}`,
  };
};
