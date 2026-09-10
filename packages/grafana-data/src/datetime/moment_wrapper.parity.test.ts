import type * as MomentWrapper from './moment_wrapper';

describe('Luxon-backed DateTime wrapper', () => {
  const flagName = '__grafanaUseLuxon';
  let originalDescriptor: PropertyDescriptor | undefined;
  let originalLocale: string;
  let wrapper: typeof MomentWrapper;

  beforeAll(async () => {
    originalDescriptor = Object.getOwnPropertyDescriptor(window, flagName);
    Object.defineProperty(window, flagName, { configurable: true, value: true });
    wrapper = await import('./moment_wrapper');
    originalLocale = wrapper.getLocale();
  });

  afterEach(() => {
    wrapper.setLocale(originalLocale);
  });

  afterAll(() => {
    if (originalDescriptor) {
      Object.defineProperty(window, flagName, originalDescriptor);
    } else {
      Reflect.deleteProperty(window, flagName);
    }
  });

  it('subtracts shorthand through the public DateTime API without replacing the instance', () => {
    const value = wrapper.toUtc('2024-05-08T12:00:00Z');

    expect(value.subtract('5m')).toBe(value);
    expect(value.toISOString()).toBe('2024-05-08T11:55:00.000Z');
    expect(wrapper.toDuration('5m').asMilliseconds()).toBe(300000);
    expect(wrapper.toDuration('5', 'minutes').asMilliseconds()).toBe(300000);
  });

  it('accepts unit objects through the public duration and arithmetic APIs', () => {
    const input = { hour: 1, hours: 2, minutes: '30' };
    expect(wrapper.toDuration(input, 'seconds').asMilliseconds()).toBe(9000000);

    const value = wrapper.toUtc('2024-05-08T12:00:00Z');
    expect(value.add(input)).toBe(value);
    expect(value.toISOString()).toBe('2024-05-08T14:30:00.000Z');
    expect(value.subtract({ h: 2, m: 30 }).toISOString()).toBe('2024-05-08T12:00:00.000Z');
  });

  it('retains the millisecond conversion path for existing duration-like inputs', () => {
    const source = wrapper.toDuration(90, 'minutes');
    expect(wrapper.toDuration(source, 'days').asMilliseconds()).toBe(5400000);
  });

  it('accepts toDuration results in public arithmetic', () => {
    const duration = wrapper.toDuration(5, 'minutes');
    const value = wrapper.toUtc('2024-05-08T12:00:00Z');

    expect(value.add(duration).toISOString()).toBe('2024-05-08T12:05:00.000Z');
    expect(value.subtract(duration).toISOString()).toBe('2024-05-08T12:00:00.000Z');
  });

  it('activates the week-start override and resets to the base locale', () => {
    wrapper.setLocale('de');
    wrapper.setWeekStart('Sunday');

    expect(wrapper.getLocale()).toBe('de-weekStart');
    expect(wrapper.getLocaleData().firstDayOfWeek()).toBe(0);
    expect(wrapper.toUtc('2024-05-08').format('MMMM')).toBe('Mai');
    expect(wrapper.toUtc('2024-05-08').startOf('weeks').toISOString()).toBe('2024-05-05T00:00:00.000Z');

    wrapper.setWeekStart();

    expect(wrapper.getLocale()).toBe('de');
    expect(wrapper.getLocaleData().firstDayOfWeek()).toBe(1);
    expect(wrapper.toUtc('2024-05-08').startOf('week').toISOString()).toBe('2024-05-06T00:00:00.000Z');
  });

  it('uses the same localized L pattern for public parsing and formatting', () => {
    wrapper.setLocale('de');
    const value = wrapper.toUtc('08.05.2024', 'L');

    expect(value.toISOString()).toBe('2024-05-08T00:00:00.000Z');
    expect(value.format('L')).toBe('08.05.2024');
    expect(wrapper.toUtc('Wed, 08 May 2024 12:00:00 GMT', wrapper.ISO_8601).isValid()).toBe(false);
  });
});
