import { AdHocVariableFilter, UrlQueryMap, UrlQueryValue } from '@grafana/data';
import { AdHocFiltersVariable, CustomVariable, sceneGraph } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';
import { VAR_OTEL_AND_METRIC_FILTERS, VAR_OTEL_DEPLOYMENT_ENV } from '../shared';

import { migrateOtelDeploymentEnvironment, migrateAdHocFilters } from './otelDeploymentEnvironment';

describe('migrate old dep env var to otel and metrics var', () => {
  describe('migrateOtelDeploymentEnvironment', () => {
    let trail = {} as DataTrail;
    beforeEach(() => {
      trail = new DataTrail({
        useOtelExperience: true,
      });
    });
    it('should not be called if var-otel_and_metric_filters is present with label', () => {
      // this variable being present indicates it has already been migrated
      const urlParams: UrlQueryMap = {
        'var-otel_and_metric_filters': ['key|=|value'],
      };

      migrateOtelDeploymentEnvironment(trail, urlParams);

      const otelMetricsVar = getOtelAndMetricsVar(trail);

      expect(otelMetricsVar.state.filters).toEqual([]);
    });

    it('should not be called if starting a new trail', () => {
      // new trails do not need to be migrated
      trail.setState({ startButtonClicked: true });

      const urlParams: UrlQueryMap = {
        'var-otel_and_metric_filters': [''],
      };

      migrateOtelDeploymentEnvironment(trail, urlParams);

      const otelMetricsVar = getOtelAndMetricsVar(trail);

      expect(otelMetricsVar.state.filters).toEqual([]);
    });

    it('should not migrate if var-deployment_environment is not present', () => {
      const urlParams: UrlQueryMap = {};

      migrateOtelDeploymentEnvironment(trail, urlParams);

      const otelMetricsVar = getOtelAndMetricsVar(trail);

      expect(otelMetricsVar.state.filters).toEqual([]);
    });

    it('should migrate deployment environment and set filters correctly', () => {
      const urlParams: UrlQueryMap = {
        'var-deployment_environment': ['env1', 'env2'],
        'var-otel_resources': ['otelResource|=|value'],
        'var-filters': ['metricFilter|=|value'],
      };

      migrateOtelDeploymentEnvironment(trail, urlParams);

      const expectedFilters = [
        {
          key: 'deployment_environment',
          operator: '=~',
          value: 'env1|env2',
        },
        {
          key: 'otelResource',
          operator: '=',
          value: 'value',
        },
        {
          key: 'metricFilter',
          operator: '=',
          value: 'value',
        },
        // Add expected otelFilters and metricFilters here
      ];

      const otelMetricsVar = getOtelAndMetricsVar(trail);
      expect(otelMetricsVar.state.filters).toEqual(expectedFilters);
      // should clear out the dep env var
      const depEnvVar = getDepEnvVar(trail);
      expect(depEnvVar.state.value).toBe('');
    });
  });

  describe('migrateAdHocFilters', () => {
    it('should return empty array when urlFilter is not present', () => {
      const urlFilter: UrlQueryValue = null;
      const filters: AdHocVariableFilter[] = [];
      migrateAdHocFilters(urlFilter, filters);
      expect(filters).toEqual([]);
    });

    it('should return filters when urlFilter is present', () => {
      const urlFilter: UrlQueryValue = ['someKey|=|someValue'];
      const filters: AdHocVariableFilter[] = [];
      migrateAdHocFilters(urlFilter, filters);
      const expected = [
        {
          key: 'someKey',
          operator: '=',
          value: 'someValue',
        },
      ];
      expect(filters).toEqual(expected);
    });
  });

  function getOtelAndMetricsVar(trail: DataTrail) {
    const variable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);
    if (variable instanceof AdHocFiltersVariable) {
      return variable;
    }
    throw new Error('getOtelAndMetricsVar failed');
  }

  function getDepEnvVar(trail: DataTrail) {
    const variable = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, trail);
    if (variable instanceof CustomVariable) {
      return variable;
    }
    throw new Error('getDepVar failed');
  }
});
