import { MatcherOperator, ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';

import { findRoutesByMatchers } from './Filters';

describe('findRoutesByMatchers', () => {
  it('should match even if keys or values are quoted', () => {
    const routes = [
      { id: '0', matchers: ['foo=bar'] },
      { id: '0', matchers: ['foo="bar"'] },
      { id: '0', matchers: ['"foo"=bar'] },
      { id: '0', matchers: ['"foo"="bar"'] },
    ];

    const matchers: ObjectMatcher[] = [
      ['foo', MatcherOperator.equal, 'bar'],
      ['foo', MatcherOperator.equal, '"bar"'],
      ['"foo"', MatcherOperator.equal, 'bar'],
      ['"foo"', MatcherOperator.equal, '"bar"'],
    ];

    routes.forEach((route) => {
      matchers.forEach((matcher) => {
        expect(findRoutesByMatchers(route, [matcher])).toBe(true);
      });
    });
  });

  it('should match even if keys or values are quoted with special characters', () => {
    const routes = [
      { id: '0', matchers: ['foo="bar baz"'] },
      { id: '0', matchers: ['"foo"="bar baz"'] },
    ];

    const matchers: ObjectMatcher[] = [
      ['foo', MatcherOperator.equal, 'bar baz'],
      ['foo', MatcherOperator.equal, '"bar baz"'],
      ['"foo"', MatcherOperator.equal, 'bar baz'],
      ['"foo"', MatcherOperator.equal, '"bar baz"'],
    ];

    matchers.forEach((matcher) => {
      routes.forEach((route) => {
        expect(findRoutesByMatchers(route, [matcher])).toBe(true);
      });
    });
  });
});
