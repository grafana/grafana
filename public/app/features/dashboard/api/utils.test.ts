import { config } from '@grafana/runtime';

import { getScopes, getTimeRangeAndFilters } from './utils';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getSearchObject: () => ({
      to: 'to',
      from: 'from',
      'var-1': ['value2', 'value1'],
      timezone: 'timezone',
      anotherVariable: 'anotherVarValue',
      'var-2': 'value',
    }),
  },
}));

jest.mock('app/features/scopes', () => ({
  getSelectedScopesNames: () => ['scope2', 'scope1'],
}));

describe('Dashboard API utils', () => {
  describe('getScopes', () => {
    describe('passReloadParamsToDashboardApi off', () => {
      beforeAll(() => {
        config.featureToggles.passReloadParamsToDashboardApi = false;
      });

      it('Returns undefined', () => {
        expect(getScopes()).toBeUndefined();
      });
    });

    describe('passReloadParamsToDashboardApi on', () => {
      beforeAll(() => {
        config.featureToggles.passReloadParamsToDashboardApi = true;
      });

      it('Returns sorted scopes', () => {
        expect(getScopes(true)).toEqual(['scope1', 'scope2']);
      });

      it('Returns unsorted scopes', () => {
        expect(getScopes()).toEqual(['scope2', 'scope1']);
      });
    });
  });

  describe('getTimeRangeAndFilters', () => {
    describe('passReloadParamsToDashboardApi off', () => {
      beforeAll(() => {
        config.featureToggles.passReloadParamsToDashboardApi = false;
      });

      it('Returns undefined', () => {
        expect(getTimeRangeAndFilters()).toBeUndefined();
      });
    });

    describe('passReloadParamsToDashboardApi on', () => {
      beforeAll(() => {
        config.featureToggles.passReloadParamsToDashboardApi = true;
      });

      it('Returns sorted time range and filters', () => {
        expect(getTimeRangeAndFilters(true)).toEqual({
          from: 'from',
          timezone: 'timezone',
          to: 'to',
          'var-1': ['value1', 'value2'],
          'var-2': 'value',
        });
      });

      it('Returns unsorted time range and filters', () => {
        expect(getTimeRangeAndFilters()).toEqual({
          to: 'to',
          from: 'from',
          'var-1': ['value2', 'value1'],
          timezone: 'timezone',
          'var-2': 'value',
        });
      });
    });
  });
});
