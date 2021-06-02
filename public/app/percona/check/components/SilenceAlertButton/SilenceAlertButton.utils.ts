/* eslint-disable no-restricted-imports */
import { utc } from 'moment';
import { Labels } from 'app/percona/check/types';

const formatMatchers = (labels: Labels) =>
  Object.keys(labels).map(key => ({
    name: key,
    value: labels[key],
    isRegex: false,
  }));

export const makeSilencePayload = (labels: Labels) => {
  const nowUTCISO = utc().format();
  const tomorrowUTCISO = utc()
    .add(24, 'hours')
    .format();

  return {
    matchers: formatMatchers(labels),
    startsAt: nowUTCISO,
    endsAt: tomorrowUTCISO,
    createdBy: (window as any).grafanaBootData.user.name,
    comment: '',
    id: '',
  };
};
