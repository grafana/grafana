describe('__grafanaUseLuxon', () => {
  const flagName = '__grafanaUseLuxon';
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, flagName);

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(window, flagName, originalDescriptor);
    } else {
      Reflect.deleteProperty(window, flagName);
    }
  });

  it.each([
    [undefined, 'Moment'],
    [true, 'MomentCompat'],
  ])('uses the expected implementation when set to %s', async (useLuxon, constructorName) => {
    if (useLuxon === undefined) {
      Reflect.deleteProperty(window, flagName);
    } else {
      Object.defineProperty(window, flagName, { configurable: true, value: useLuxon });
    }

    await jest.isolateModulesAsync(async () => {
      const { default: moment } = await import('./moment_implementation');
      const { ISO_8601, dateTime } = await import('./moment_wrapper');

      expect(Object.getPrototypeOf(dateTime()).constructor.name).toBe(constructorName);
      expect(dateTime('2026-08-06T12:34:56Z', ISO_8601).isValid()).toBe(true);
      expect(moment.tz.zone('America/New_York')).not.toBeNull();
      expect(moment.tz.zone('not/a-zone')).toBeNull();
    });
  });
});
