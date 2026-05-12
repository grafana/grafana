import { renderHook } from '@testing-library/react';

import { useRouteGroupsMatcher } from './useRouteGroupsMatcher';

describe('useRouteGroupsMatcher', () => {
  it('should provide matcher functions', function () {
    const { result } = renderHook(() => useRouteGroupsMatcher());

    expect(result.current.getRouteGroupsMap).toBeDefined();
    expect(result.current.matchInstancesToRoutes).toBeDefined();
    expect(typeof result.current.getRouteGroupsMap).toBe('function');
    expect(typeof result.current.matchInstancesToRoutes).toBe('function');
  });

  it('should successfully call getRouteGroupsMap with valid data', async function () {
    const { result } = renderHook(() => useRouteGroupsMatcher());

    const rootRoute = { id: '1', receiver: 'default' };
    const groups = [];

    const routeGroupsMap = await result.current.getRouteGroupsMap(rootRoute, groups);

    expect(routeGroupsMap).toBeDefined();
    expect(routeGroupsMap).toBeInstanceOf(Map);
  });

  it('should successfully call matchInstancesToRoutes with valid data', async function () {
    const { result } = renderHook(() => useRouteGroupsMatcher());

    const rootRoute = { id: '1', receiver: 'default' };
    const instances = [{ alertname: 'test' }];

    const matchResults = await result.current.matchInstancesToRoutes(rootRoute, instances);

    expect(matchResults).toBeDefined();
    expect(Array.isArray(matchResults)).toBe(true);
  });
});
