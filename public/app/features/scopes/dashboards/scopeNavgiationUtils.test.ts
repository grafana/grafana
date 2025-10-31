import { getDashboardPathForComparison, isCurrentPath } from './scopeNavgiationUtils';

describe('scopeNavgiationUtils', () => {
  it('should return the correct path for a dashboard', () => {
    expect(getDashboardPathForComparison('/d/dashboardId/slug')).toBe('/d/dashboardId');
    expect(getDashboardPathForComparison('/d/dashboardId')).toBe('/d/dashboardId');
    expect(getDashboardPathForComparison('/d/dashboardId/slug?query=param')).toBe('/d/dashboardId');
  });

  it('should return the correct path for a navigation', () => {
    expect(isCurrentPath('/d/dashboardId/slug', '/d/dashboardId')).toBe(true);
    expect(isCurrentPath('/d/dashboardId', '/d/dashboardId')).toBe(true);
  });

  it('shoudl handle non-dashboard paths', () => {
    expect(isCurrentPath('/other/path', '/other/path')).toBe(true);
    expect(isCurrentPath('/other/path', '/other/path?query=param')).toBe(true);
    expect(isCurrentPath('/other/path', '/other/path#hash')).toBe(true);
    expect(isCurrentPath('/other/path', '/other/path?query=param#hash')).toBe(true);
  });

  it('should return the correct path for a navigation with query params', () => {
    expect(isCurrentPath('/d/dashboardId/slug', '/d/dashboardId?query=param')).toBe(true);
    expect(isCurrentPath('/d/dashboardId', '/d/dashboardId?query=param')).toBe(true);
  });

  it('should return the correct path for a navigation with hash', () => {
    expect(isCurrentPath('/d/dashboardId/slug', '/d/dashboardId#hash')).toBe(true);
    expect(isCurrentPath('/d/dashboardId', '/d/dashboardId#hash')).toBe(true);
  });
});
