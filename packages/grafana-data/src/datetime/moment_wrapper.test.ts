import moment, { setDateTimeImplementation } from './moment_implementation';
import { ISO_8601, dateTime } from './moment_wrapper';

describe('setDateTimeImplementation', () => {
  afterEach(() => {
    setDateTimeImplementation(false);
  });

  it.each([
    [false, 'Moment'],
    [true, 'MomentCompat'],
  ])('uses the expected implementation when set to %s', (useLuxon, constructorName) => {
    setDateTimeImplementation(useLuxon);

    expect(Object.getPrototypeOf(dateTime()).constructor.name).toBe(constructorName);
    expect(dateTime('2026-08-06T12:34:56Z', ISO_8601).isValid()).toBe(true);
    expect(moment.tz.zone('America/New_York')).not.toBeNull();
    expect(moment.tz.zone('not/a-zone')).toBeNull();
  });
});
