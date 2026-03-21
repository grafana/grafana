import { dateTime, dateTimeForTimeZone, toUtc } from './grafana_datetime_wrapper';

describe('grafana datetime wrapper', () => {
  it('re-zones existing DateTime values in dateTimeForTimeZone', () => {
    const value = dateTimeForTimeZone('utc', '2021-05-05 12:00:00', 'YYYY-MM-DD HH:mm:ss');

    expect(dateTimeForTimeZone('Europe/Stockholm', value).format('YYYY-MM-DD HH:mm:ss')).toBe('2021-05-05 14:00:00');
  });

  it('converts existing DateTime values in toUtc', () => {
    const value = dateTimeForTimeZone('Europe/Stockholm', '2021-05-05 12:00:00', 'YYYY-MM-DD HH:mm:ss');

    expect(toUtc(value).format('YYYY-MM-DD HH:mm:ss')).toBe('2021-05-05 10:00:00');
  });

  it('preserves the original zone when cloning without a target zone', () => {
    const value = dateTimeForTimeZone('Europe/Stockholm', '2021-05-05 12:00:00', 'YYYY-MM-DD HH:mm:ss');

    expect(dateTime(value).format('YYYY-MM-DD HH:mm:ss')).toBe('2021-05-05 12:00:00');
  });
});
