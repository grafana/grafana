import { consumeDashboardFetchTiming, recordDashboardFetchTiming } from './DashboardFetchTiming';

describe('DashboardFetchTiming', () => {
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
});
