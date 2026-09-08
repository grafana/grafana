import { consumeDashboardFetchTiming, recordDashboardFetchTiming } from './DashboardFetchTiming';

describe('DashboardFetchTiming', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the recorded duration for a matching uid', () => {
    recordDashboardFetchTiming('dash-1', 123.4);

    expect(consumeDashboardFetchTiming('dash-1')).toBe(123.4);
  });

  it('returns undefined when the requested uid does not match the stored one', () => {
    recordDashboardFetchTiming('dash-1', 123.4);

    expect(consumeDashboardFetchTiming('dash-2')).toBeUndefined();
  });

  it('leaves the slot untouched on a uid mismatch, so a later matching read still succeeds', () => {
    recordDashboardFetchTiming('dash-1', 123.4);

    expect(consumeDashboardFetchTiming('dash-2')).toBeUndefined();
    expect(consumeDashboardFetchTiming('dash-1')).toBe(123.4);
  });

  it('matches any uid when the stored uid is undefined (slug-based routes)', () => {
    recordDashboardFetchTiming(undefined, 55);

    expect(consumeDashboardFetchTiming('dash-1')).toBe(55);
  });

  it('is consume-once - a second read after a match returns undefined', () => {
    recordDashboardFetchTiming('dash-1', 42);

    expect(consumeDashboardFetchTiming('dash-1')).toBe(42);
    expect(consumeDashboardFetchTiming('dash-1')).toBeUndefined();
  });

  it('reflects the most recent recording, overwriting the previous slot', () => {
    recordDashboardFetchTiming('dash-1', 10);
    recordDashboardFetchTiming('dash-2', 20);

    expect(consumeDashboardFetchTiming('dash-1')).toBeUndefined();
    expect(consumeDashboardFetchTiming('dash-2')).toBe(20);
  });

  describe('notBefore staleness guard', () => {
    it('returns the duration when recorded at or after notBefore', () => {
      jest.spyOn(performance, 'now').mockReturnValue(1000);
      recordDashboardFetchTiming('dash-1', 42);

      expect(consumeDashboardFetchTiming('dash-1', 900)).toBe(42);
    });

    it('discards a timing recorded before notBefore, but still clears the slot', () => {
      jest.spyOn(performance, 'now').mockReturnValue(1000);
      recordDashboardFetchTiming('dash-1', 42);

      expect(consumeDashboardFetchTiming('dash-1', 1500)).toBeUndefined();
      // The stale timing must not be attributed to a later consume - the slot is gone either way.
      expect(consumeDashboardFetchTiming('dash-1', 900)).toBeUndefined();
    });

    it('applies the old (unguarded) behavior when notBefore is omitted', () => {
      jest.spyOn(performance, 'now').mockReturnValue(1000);
      recordDashboardFetchTiming('dash-1', 42);

      expect(consumeDashboardFetchTiming('dash-1')).toBe(42);
    });
  });
});
