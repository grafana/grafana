import { Route } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../types/amroutes';

import { amRouteToFormAmRoute, emptyRoute, formAmRouteToAmRoute } from './amroutes';

const emptyAmRoute: Route = {
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

const buildAmRoute = (override: Partial<Route> = {}): Route => {
  return { ...emptyAmRoute, ...override };
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
});

describe('amRouteToFormAmRoute', () => {
  describe('when called with empty group_by array', () => {
    it('should set overrideGrouping true and groupBy empty', () => {
      // Arrange
      const amRoute = buildAmRoute({ group_by: [] });

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
      const amRoute = buildAmRoute({ group_by: group_by });

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
      const amRoute = buildAmRoute({ group_by: ['SHOULD BE SET'] });

      // Act
      const formRoute = amRouteToFormAmRoute(amRoute);

      // Assert
      expect(formRoute.groupBy).toStrictEqual(['SHOULD BE SET']);
      expect(formRoute.overrideGrouping).toBe(true);
    });
  });
});
