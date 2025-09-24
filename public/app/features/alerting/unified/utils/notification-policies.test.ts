import { MatcherOperator, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { normalizeRoute, unquoteRouteMatchers } from './notification-policies';

describe('normalizeRoute', () => {
  it('should map matchers property to object_matchers', function () {
    const route: RouteWithID = {
      id: '1',
      matchers: ['foo=bar', 'foo=~ba.*'],
    };

    const normalized = normalizeRoute(route);

    expect(normalized.object_matchers).toHaveLength(2);
    expect(normalized.object_matchers).toContainEqual(['foo', MatcherOperator.equal, 'bar']);
    expect(normalized.object_matchers).toContainEqual(['foo', MatcherOperator.regex, 'ba.*']);
    expect(normalized).not.toHaveProperty('matchers');
  });

  it('should map match and match_re properties to object_matchers', function () {
    const route: RouteWithID = {
      id: '1',
      match: {
        foo: 'bar',
      },
      match_re: {
        team: 'op.*',
      },
    };

    const normalized = normalizeRoute(route);

    expect(normalized.object_matchers).toHaveLength(2);
    expect(normalized.object_matchers).toContainEqual(['foo', MatcherOperator.equal, 'bar']);
    expect(normalized.object_matchers).toContainEqual(['team', MatcherOperator.regex, 'op.*']);

    expect(normalized).not.toHaveProperty('match');
    expect(normalized).not.toHaveProperty('match_re');
  });
});

describe('unquoteRouteMatchers', () => {
  it('should unquote and unescape matchers values', () => {
    const route: RouteWithID = {
      id: '1',
      object_matchers: [
        ['foo', MatcherOperator.equal, 'bar'],
        ['foo', MatcherOperator.equal, '"bar"'],
        ['foo', MatcherOperator.equal, '"b\\\\ar b\\"az"'],
      ],
    };

    const unwrapped = unquoteRouteMatchers(route);

    expect(unwrapped.object_matchers).toHaveLength(3);
    expect(unwrapped.object_matchers).toContainEqual(['foo', MatcherOperator.equal, 'bar']);
    expect(unwrapped.object_matchers).toContainEqual(['foo', MatcherOperator.equal, 'bar']);
    expect(unwrapped.object_matchers).toContainEqual(['foo', MatcherOperator.equal, 'b\\ar b"az']);
  });

  it('should unquote and unescape matcher names', () => {
    const route: RouteWithID = {
      id: '1',
      object_matchers: [
        ['"f\\"oo with quote"', MatcherOperator.equal, 'bar'],
        ['"f\\\\oo with slash"', MatcherOperator.equal, 'bar'],
      ],
    };

    const unwrapped = unquoteRouteMatchers(route);

    expect(unwrapped.object_matchers).toHaveLength(2);
    expect(unwrapped.object_matchers).toContainEqual(['f"oo with quote', MatcherOperator.equal, 'bar']);
    expect(unwrapped.object_matchers).toContainEqual(['f\\oo with slash', MatcherOperator.equal, 'bar']);
  });
});
