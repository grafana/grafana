import { localTimeFormat, systemDateFormats } from './formats';

describe('Date Formats', () => {
  it('localTimeFormat', () => {
    const format = localTimeFormat(
      {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      },
      ''
    );

    expect(format).toBe('MM/DD/YYYY, hh:mm:ss A');
  });
});

describe('Date Formats without hour12', () => {
  it('localTimeFormat', () => {
    const format = localTimeFormat(
      {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      },
      ''
    );

    expect(format).toBe('MM/DD/YYYY, HH:mm:ss');
  });
});

describe('systemDateFormats', () => {
  it('contains correct date formats', () => {
    expect(systemDateFormats.fullDate).toBe('YYYY-MM-DD HH:mm:ss');
    expect(systemDateFormats.fullDateMS).toBe('YYYY-MM-DD HH:mm:ss.SSS');
    expect(systemDateFormats.interval.millisecond).toBe('HH:mm:ss.SSS');
    expect(systemDateFormats.interval.second).toBe('HH:mm:ss');
    expect(systemDateFormats.interval.minute).toBe('HH:mm');
    expect(systemDateFormats.interval.hour).toBe('MM/DD HH:mm');
    expect(systemDateFormats.interval.day).toBe('MM/DD');
    expect(systemDateFormats.interval.month).toBe('YYYY-MM');
    expect(systemDateFormats.interval.year).toBe('YYYY');
  });

  it('contains correct browser-localized date formats', () => {
    systemDateFormats.useBrowserLocale();
    expect(systemDateFormats.fullDate).toBe('MM/DD/YYYY, hh:mm:ss A');
    expect(systemDateFormats.fullDateMS).toBe('MM/DD/YYYY, hh:mm:ss.SSS A');
    expect(systemDateFormats.interval.millisecond).toBe('HH:mm:ss.SSS');
    expect(systemDateFormats.interval.second).toBe('HH:mm:ss');
    expect(systemDateFormats.interval.minute).toBe('HH:mm');
    expect(systemDateFormats.interval.hour).toBe('MM/DD, HH:mm');
    expect(systemDateFormats.interval.day).toBe('MM/DD');
    expect(systemDateFormats.interval.month).toBe('MM/YYYY');
    expect(systemDateFormats.interval.year).toBe('YYYY');
  });
});
