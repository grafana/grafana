import { dateTime, DateTime, isDateTime } from '@grafana/data';

export const processDateTime = (dt: DateTime | string) => {
  return isDateTime(dt) ? dateTime(dt) : dt;
};
