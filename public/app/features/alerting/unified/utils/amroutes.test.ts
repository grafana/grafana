import { uniqueId } from 'lodash';

import { MatcherOperator, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../types/amroutes';

import { amRouteToFormAmRoute, emptyRoute, formAmRouteToAmRoute } from './amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from './datasource';

const emptyAmRoute: RouteWithID = {
  id: uniqueId(),
  receiver: '',
  group_by: [],
  continue: false,
  object_matchers: [],
  matchers: [],
  match: {},
  match_re: {},
  group_wait: '',
  group_interval: '',
  repeat_interval: '',
  routes: [],
  mute_time_intervals: [],
};

const buildAmRouteWithID = (override: Partial<RouteWithID> = {}): RouteWithID => {
  return { ...emptyAmRoute, ...override, id: uniqueId() };
};

const buildFormAmRoute = (override: Partial<FormAmRoute> = {}): FormAmRoute => {
  return { ...emptyRoute, ...override };
};

describe('formAmRouteToAmRoute', () => {
  describe('when called with overrideGrouping=false', () => {
    it('Should not set groupBy', () => {
      // Arrange
      const route: FormAmRoute = buildFormAmRoute({ id: '1', overrideGrouping: false, groupBy: ['SHOULD NOT BE SET'] });

      // Act
      const amRoute = formAmRouteToAmRoute('test', route, { id: 'root' });

      // Assert
      expect(amRoute.group_by).toStrictEqual(undefined);
    });
  });

  describe('when called with overrideGrouping=true', () => {
    it('Should set groupBy', () => {
      // Arrange
      const route: FormAmRoute = buildFormAmRoute({ id: '1', overrideGrouping: true, groupBy: ['SHOULD BE SET'] });

      // Act
      const amRoute = formAmRouteToAmRoute('test', route, { id: 'root' });

      // Assert
      expect(amRoute.group_by).toStrictEqual(['SHOULD BE SET']);
    });
  });

  it('should quote and escape matcher values', () => {
    // Arrange
    const route: FormAmRoute = buildFormAmRoute({
      id: '1',
      object_matchers: [
        { name: 'foo', operator: MatcherOperator.equal, value: 'bar' },
        { name: 'foo', operator: MatcherOperator.equal, value: 'bar"baz' },
        { name: 'foo', operator: MatcherOperator.equal, value: 'bar\\baz' },
        { name: 'foo', operator: MatcherOperator.equal, value: '\\bar\\baz"\\' },
      ],
    });

    // Act
    const amRoute = formAmRouteToAmRoute('mimir-am', route, { id: 'root' });

    // Assert
    expect(amRoute.matchers).toStrictEqual([
      'foo="bar"',
      'foo="bar\\"baz"',
      'foo="bar\\\\baz"',
      'foo="\\\\bar\\\\baz\\"\\\\"',
    ]);
  });

  it('should quote and escape matcher names', () => {
    // Arrange
    const route: FormAmRoute = buildFormAmRoute({
      id: '1',
      object_matchers: [
        { name: 'foo', operator: MatcherOperator.equal, value: 'bar' },
        { name: 'foo with spaces', operator: MatcherOperator.equal, value: 'bar' },
        { name: 'foo\\slash', operator: MatcherOperator.equal, value: 'bar' },
        { name: 'foo"quote', operator: MatcherOperator.equal, value: 'bar' },
        { name: 'fo\\o', operator: MatcherOperator.equal, value: 'ba\\r' },
      ],
    });

    // Act
    const amRoute = formAmRouteToAmRoute('mimir-am', route, { id: 'root' });

    // Assert
    expect(amRoute.matchers).toStrictEqual([
      'foo="bar"',
      '"foo with spaces"="bar"',
      '"foo\\\\slash"="bar"',
      '"foo\\"quote"="bar"',
      '"fo\\\\o"="ba\\\\r"',
    ]);
  });

  it('should allow matchers with empty values for cloud AM', () => {
    // Arrange
    const route: FormAmRoute = buildFormAmRoute({
      id: '1',
      object_matchers: [{ name: 'foo', operator: MatcherOperator.equal, value: '' }],
    });

    // Act
    const amRoute = formAmRouteToAmRoute('mimir-am', route, { id: 'root' });

    // Assert
    expect(amRoute.matchers).toStrictEqual(['foo=""']);
  });

  it('should allow matchers with empty values for Grafana AM', () => {
    // Arrange
    const route: FormAmRoute = buildFormAmRoute({
      id: '1',
      object_matchers: [{ name: 'foo', operator: MatcherOperator.equal, value: '' }],
    });

    // Act
    const amRoute = formAmRouteToAmRoute(GRAFANA_RULES_SOURCE_NAME, route, { id: 'root' });

    // Assert
    expect(amRoute.object_matchers).toStrictEqual([['foo', MatcherOperator.equal, '']]);
  });
});

describe('amRouteToFormAmRoute', () => {
  describe('when called with empty group_by array', () => {
    it('should set overrideGrouping true and groupBy empty', () => {
      // Arrange
      const amRoute = buildAmRouteWithID({ group_by: [] });

      // Act
      const formRoute = amRouteToFormAmRoute(amRoute);

      // Assert
      expect(formRoute.groupBy).toStrictEqual([]);
      expect(formRoute.overrideGrouping).toBe(false);
    });
  });

  describe('when called with empty group_by', () => {
    it.each`
      group_by
      ${null}
      ${undefined}
    `("when group_by is '$group_by', should set overrideGrouping false", ({ group_by }) => {
      // Arrange
      const amRoute = buildAmRouteWithID({ group_by: group_by });

      // Act
      const formRoute = amRouteToFormAmRoute(amRoute);

      // Assert
      expect(formRoute.groupBy).toStrictEqual(undefined);
      expect(formRoute.overrideGrouping).toBe(false);
    });
  });

  describe('when called with non-empty group_by', () => {
    it('Should set overrideGrouping true and groupBy', () => {
      // Arrange
      const amRoute = buildAmRouteWithID({ group_by: ['SHOULD BE SET'] });

      // Act
      const formRoute = amRouteToFormAmRoute(amRoute);

      // Assert
      expect(formRoute.groupBy).toStrictEqual(['SHOULD BE SET']);
      expect(formRoute.overrideGrouping).toBe(true);
    });
  });

  it('should unquote and unescape matchers values', () => {
    // Arrange
    const amRoute = buildAmRouteWithID({
      matchers: ['foo=bar', 'foo="bar"', 'foo="bar"baz"', 'foo="bar\\\\baz"', 'foo="\\\\bar\\\\baz"\\\\"'],
    });

    // Act
    const formRoute = amRouteToFormAmRoute(amRoute);

    // Assert
    expect(formRoute.object_matchers).toStrictEqual([
      { name: 'foo', operator: MatcherOperator.equal, value: 'bar' },
      { name: 'foo', operator: MatcherOperator.equal, value: 'bar' },
      { name: 'foo', operator: MatcherOperator.equal, value: 'bar"baz' },
      { name: 'foo', operator: MatcherOperator.equal, value: 'bar\\baz' },
      { name: 'foo', operator: MatcherOperator.equal, value: '\\bar\\baz"\\' },
    ]);
  });

  it('should unquote and unescape matcher names', () => {
    // Arrange
    const amRoute = buildAmRouteWithID({
      matchers: ['"foo"=bar', '"foo with spaces"=bar', '"foo\\\\slash"=bar', '"foo"quote"=bar', '"fo\\\\o"="ba\\\\r"'],
    });

    // Act
    const formRoute = amRouteToFormAmRoute(amRoute);

    // Assert
    expect(formRoute.object_matchers).toStrictEqual([
      { name: 'foo', operator: MatcherOperator.equal, value: 'bar' },
      { name: 'foo with spaces', operator: MatcherOperator.equal, value: 'bar' },
      { name: 'foo\\slash', operator: MatcherOperator.equal, value: 'bar' },
      { name: 'foo"quote', operator: MatcherOperator.equal, value: 'bar' },
      { name: 'fo\\o', operator: MatcherOperator.equal, value: 'ba\\r' },
    ]);
  });
});
