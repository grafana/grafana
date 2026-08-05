describe('datetime.useLuxon', () => {
  const featureToggles = window.grafanaBootData.settings.featureToggles;
  const originalValue = featureToggles['datetime.useLuxon'];

  afterEach(() => {
    featureToggles['datetime.useLuxon'] = originalValue;
  });

  it.each([
    [false, 'Moment'],
    [true, 'MomentCompat'],
  ])('uses the expected implementation when set to %s', async (useLuxon, constructorName) => {
    featureToggles['datetime.useLuxon'] = useLuxon;

    await jest.isolateModulesAsync(async () => {
      const { dateTime } = await import('./moment_wrapper');

      expect(Object.getPrototypeOf(dateTime()).constructor.name).toBe(constructorName);
    });
  });
});
