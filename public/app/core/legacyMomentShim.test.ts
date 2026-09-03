import legacyMoment, { setLegacyMoment, tz } from './legacyMomentShim';

describe('legacyMomentShim', () => {
  it('exposes the implementation installed during bootstrap', () => {
    const timezone = jest.fn();
    const implementation = Object.assign(jest.fn(), { tz: timezone }) as unknown as NonNullable<typeof legacyMoment>;

    setLegacyMoment(implementation);

    expect(legacyMoment).toBe(implementation);
    expect(tz).toBe(timezone);
  });
});
