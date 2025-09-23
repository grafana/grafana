import moment from 'moment';

export const dateDifferenceInWords = (date1: string, date2: string) => {
  const momentDate1 = moment(date1);
  const momentDate2 = moment(date2);
  const duration = moment.duration(momentDate1.diff(momentDate2));

  if (duration.asDays() >= 1) {
    return `${Math.floor(duration.asDays())} day${duration.asDays() > 1 ? 's' : ''}`;
  } else if (duration.asHours() >= 1) {
    return `${Math.floor(duration.asHours())} hour${duration.asHours() > 1 ? 's' : ''}`;
  } else if (duration.asMinutes() >= 1) {
    return `${Math.floor(duration.asMinutes())} minute${duration.asMinutes() > 1 ? 's' : ''}`;
  } else {
    return 'Less than a minute';
  }
};
