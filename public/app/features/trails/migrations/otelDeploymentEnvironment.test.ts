import { UrlQueryMap, UrlQueryValue } from '@grafana/data';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';
import { VAR_OTEL_AND_METRIC_FILTERS } from '../shared';

import { migrateOtelDeploymentEnvironment, migrateAdHocFilters } from './otelDeploymentEnvironment';

describe('migrate old dep env var to otel and metrics var', () => {
  describe('migrateOtelDeploymentEnvironment', () => {
    let trail = {} as DataTrail;
    beforeEach(() => {
      trail = new DataTrail({
        useOtelExperience: true,
      });
    });
    it('should not migrate if var-otel_and_metric_filters is present', () => {
      const urlParams: UrlQueryMap = {
        'var-otel_and_metric_filters': 'key|=|value',
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
    });

    // it('should not set filters when otelAndMetricsFiltersVariable is not an instance of AdHocFiltersVariable', () => {
    //   const trail = {} as DataTrail;
    //   const urlParams: UrlQueryMap = {
    //     'var-deployment_environment': ['env1', 'env2'],
    //     'var-otel_resources': 'otelResource',
    //     'var-filters': 'metricFilter',
    //   };
    //   const VAR_OTEL_AND_METRIC_FILTERS = 'var-otel_and_metric_filters';

    //   const sceneGraph = {
    //     lookupVariable: jest.fn().mockReturnValue({}),
    //   };

    //   migrateOtelDeploymentEnvironment(trail, urlParams);

    //   const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);
    //   expect(otelAndMetricsFiltersVariable.setState).not.toHaveBeenCalled();
    // });
  });

  describe('migrateAdHocFilters', () => {
    it('should return empty array when urlFilter is not present', () => {
      const urlFilter: UrlQueryValue = null;
      const result = migrateAdHocFilters(urlFilter);
      expect(result).toEqual([]);
    });

    it('should return filters when urlFilter is present', () => {
      const urlFilter: UrlQueryValue = ['someKey|=|someValue'];
      const result = migrateAdHocFilters(urlFilter);
      const expected = [
        {
          key: 'someKey',
          operator: '=',
          value: 'someValue',
        },
      ];
      expect(result).toEqual(expected);
    });
  });

  function getOtelAndMetricsVar(trail: DataTrail) {
    const variable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);
    if (variable instanceof AdHocFiltersVariable) {
      return variable;
    }
    throw new Error('getOtelAndMetricsVar failed');
  }
});
