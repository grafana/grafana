import { MatcherOperator, ROUTES_META_SYMBOL, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../types/amroutes';

import { GRAFANA_DATASOURCE_NAME } from './datasource';
import {
  addRouteToReferenceRoute,
  cleanRouteIDs,
  findRouteInTree,
  hashRoute,
  omitRouteFromRouteTree,
  stabilizeRoute,
} from './routeTree';

describe('findRouteInTree', () => {
  it('should find the correct route', () => {
    const needle: RouteWithID = { id: 'route-2' };

    const root: RouteWithID = {
      id: 'route-0',
      routes: [{ id: 'route-1' }, needle, { id: 'route-3', routes: [{ id: 'route-4' }] }],
    };

    expect(findRouteInTree(root, 'route-2')).toStrictEqual([needle, root, 1]);
  });

  it('should return undefined for unknown route', () => {
    const root: RouteWithID = {
      id: 'route-0',
      routes: [{ id: 'route-1' }],
    };

    expect(findRouteInTree(root, 'none')).toStrictEqual([undefined, undefined, undefined]);
  });
});

describe('addRouteToReferenceRoute', () => {
  const targetRouteIdentifier = 'route-3';
  const root: RouteWithID = {
    id: 'route-1',
    routes: [{ id: 'route-2' }, { id: targetRouteIdentifier }],
  };

  const newRoute: Partial<FormAmRoute> = {
    id: 'new-route',
    receiver: 'new-route',
  };

  it('should be able to add above', () => {
    expect(
      addRouteToReferenceRoute(GRAFANA_DATASOURCE_NAME, newRoute, targetRouteIdentifier, root, 'above')
    ).toMatchSnapshot();
  });

  it('should be able to add below', () => {
    expect(
      addRouteToReferenceRoute(GRAFANA_DATASOURCE_NAME, newRoute, targetRouteIdentifier, root, 'below')
    ).toMatchSnapshot();
  });

  it('should be able to add as child', () => {
    expect(
      addRouteToReferenceRoute(GRAFANA_DATASOURCE_NAME, newRoute, targetRouteIdentifier, root, 'child')
    ).toMatchSnapshot();
  });

  it('should throw if target route does not exist', () => {
    expect(() => addRouteToReferenceRoute(GRAFANA_DATASOURCE_NAME, newRoute, 'unknown', root, 'child')).toThrow();
  });
});

describe('omitRouteFromRouteTree', () => {
  it('should omit route from tree', () => {
    const tree: RouteWithID = {
      id: 'route-1',
      receiver: 'root',
      routes: [
        { id: 'route-2', receiver: 'receiver-2' },
        { id: 'route-3', receiver: 'receiver-3', routes: [{ id: 'route-4', receiver: 'receiver-4' }] },
      ],
    };

    expect(omitRouteFromRouteTree('route-4', tree)).toEqual({
      id: 'route-1',
      receiver: 'root',
      routes: [
        { id: 'route-2', receiver: 'receiver-2' },
        { id: 'route-3', receiver: 'receiver-3', routes: [] },
      ],
    });
  });

  it('should throw when removing root route from tree', () => {
    const tree: RouteWithID = {
      id: 'route-1',
    };

    expect(() => {
      omitRouteFromRouteTree(tree.id, { id: 'route-1' });
    }).toThrow();
  });
});

describe('cleanRouteIDs', () => {
  it('should remove IDs from routesr recursively', () => {
    expect(
      cleanRouteIDs({
        id: '1',
        receiver: '1',
        routes: [
          { id: '2', receiver: '2' },
          { id: '3', receiver: '3' },
        ],
      })
    ).toEqual({ receiver: '1', routes: [{ receiver: '2' }, { receiver: '3' }] });
  });

  it('should also accept regular routes', () => {
    expect(cleanRouteIDs({ receiver: 'test' })).toEqual({ receiver: 'test' });
  });
});

describe('hashRoute and stabilizeRoute', () => {
  it('should sort the correct route properties', () => {
    const route: Route = {
      receiver: 'foo',
      group_by: ['g2', 'g1'],
      object_matchers: [
        ['name2', MatcherOperator.equal, 'value2'],
        ['name1', MatcherOperator.equal, 'value1'],
      ],
      routes: [{ receiver: 'b' }, { receiver: 'a' }],
      match: {
        b: 'b',
        a: 'a',
      },
    };

    const expected: Route = {
      active_time_intervals: [],
      continue: false,
      group_interval: '',
      group_wait: '',
      group_by: ['g1', 'g2'],
      match: {
        a: 'a',
        b: 'b',
      },
      match_re: {},
      matchers: [],
      mute_time_intervals: [],
      object_matchers: [
        ['name1', MatcherOperator.equal, 'value1'],
        ['name2', MatcherOperator.equal, 'value2'],
      ],
      provenance: '',
      receiver: 'foo',
      repeat_interval: '',
      routes: [{ receiver: 'b' }, { receiver: 'a' }],
      [ROUTES_META_SYMBOL]: {},
    };

    // the stabilizedRoute should match what we expect
    expect(stabilizeRoute(route)).toEqual(expected);

    // the hash of the route should be stable (so we assert is twice)
    expect(hashRoute(route)).toBe('-1tfmmx');
    expect(hashRoute(route)).toBe('-1tfmmx');
    expect(hashRoute(expected)).toBe('-1tfmmx');

    // the hash of the unstabilized route should be the same as the stabilized route
    // because the hash function will stabilize the inputs
    expect(hashRoute(route)).toBe(hashRoute(expected));
  });
});
