import { renderHook } from '@testing-library/react';

import type { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';
import type { Labels } from '../../../types/unified-alerting-dto';

// JSDOM does not support Workers and the factory uses import.meta.url which
// cannot be used in CommonJS. The __mocks__ stub is picked up automatically.
jest.mock('./createRouteGroupsMatcherWorker');

// Make comlink.wrap() return the real routeGroupsMatcher methods directly so
// tests exercise actual matching logic without a worker.
jest.mock('comlink', () => {
  const { routeGroupsMatcher } = jest.requireActual('./routeGroupsMatcher');
  const releaseProxySymbol = Symbol('releaseProxy');
  return {
    wrap: jest.fn(() => ({ ...routeGroupsMatcher, [releaseProxySymbol]: jest.fn() })),
    releaseProxy: releaseProxySymbol,
    expose: jest.fn(),
  };
});

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

    const rootRoute: RouteWithID = { id: '1', receiver: 'default' };
    const groups: AlertmanagerGroup[] = [];

    const routeGroupsMap = await result.current.getRouteGroupsMap(rootRoute, groups);

    expect(routeGroupsMap).toBeDefined();
    expect(routeGroupsMap).toBeInstanceOf(Map);
  });

  it('should successfully call matchInstancesToRoutes with valid data', async function () {
    const { result } = renderHook(() => useRouteGroupsMatcher());

    const rootRoute: RouteWithID = { id: '1', receiver: 'default' };
    const instances: Labels[] = [{ alertname: 'test' }];

    const matchResults = await result.current.matchInstancesToRoutes(rootRoute, instances);

    expect(matchResults).toBeDefined();
    expect(Array.isArray(matchResults)).toBe(true);
  });
});
