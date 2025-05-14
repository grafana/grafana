import { AdHocVariableFilter, MetricFindValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { AdHocFiltersVariable, ConstantVariable, sceneGraph } from '@grafana/scenes';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';

import { DataTrail } from '../DataTrail';
import {
  VAR_FILTERS,
  VAR_OTEL_AND_METRIC_FILTERS,
  VAR_OTEL_GROUP_LEFT,
  VAR_OTEL_JOIN_QUERY,
  VAR_OTEL_RESOURCES,
} from '../shared';

import {
  sortResources,
  getOtelJoinQuery,
  blessedList,
  limitOtelMatchTerms,
  updateOtelJoinWithGroupLeft,
  getProdOrDefaultEnv,
  updateOtelData,
  manageOtelAndMetricFilters,
} from './util';

jest.mock('./api', () => ({
  totalOtelResources: jest.fn(() => ({ job: 'oteldemo', instance: 'instance' })),
  getDeploymentEnvironments: jest.fn(() => ['production', 'staging']),
  isOtelStandardization: jest.fn(() => true),
  getFilteredResourceAttributes: jest
    .fn()
    .mockResolvedValue({ attributes: ['resourceAttribute'], missingOtelTargets: false }),
}));

describe('sortResources', () => {
  it('should sort and filter resources correctly', () => {
    const resources: MetricFindValue[] = [
      { text: 'cloud_region', value: 'cloud_region' },
      { text: 'custom_resource', value: 'custom_resource' },
    ];
    const excluded: string[] = ['cloud_region'];

    const result = sortResources(resources, excluded);

    expect(result).toEqual([{ text: 'custom_resource', value: 'custom_resource' }]);
  });
});

describe('getOtelJoinQuery', () => {
  it('should return the correct join query', () => {
    const otelResourcesObject = {
      filters: 'job="test-job",instance="test-instance"',
      labels: 'deployment_environment,custom_label',
    };

    const result = getOtelJoinQuery(otelResourcesObject);

    expect(result).toBe(
      '* on (job, instance) group_left() topk by (job, instance) (1, target_info{job="test-job",instance="test-instance"})'
    );
  });

  it('should return a join query if filters or labels are missing', () => {
    const otelResourcesObject = {
      filters: '',
      labels: '',
    };

    const result = getOtelJoinQuery(otelResourcesObject);

    expect(result).toBe('* on (job, instance) group_left() topk by (job, instance) (1, target_info{})');
  });
});

describe('blessedList', () => {
  it('should return the correct blessed list', () => {
    const result = blessedList();
    expect(result).toEqual({
      cloud_availability_zone: 0,
      cloud_region: 0,
      container_name: 0,
      k8s_cluster_name: 0,
      k8s_container_name: 0,
      k8s_cronjob_name: 0,
      k8s_daemonset_name: 0,
      k8s_deployment_name: 0,
      k8s_job_name: 0,
      k8s_namespace_name: 0,
      k8s_pod_name: 0,
      k8s_replicaset_name: 0,
      k8s_statefulset_name: 0,
      service_instance_id: 0,
      service_name: 0,
      service_namespace: 0,
    });
  });
});

describe('sortResources', () => {
  it('should sort and filter resources correctly', () => {
    const resources: MetricFindValue[] = [
      { text: 'cloud_region', value: 'cloud_region' },
      { text: 'custom_resource', value: 'custom_resource' },
    ];
    const excluded: string[] = ['cloud_region'];

    const result = sortResources(resources, excluded);

    expect(result).toEqual([{ text: 'custom_resource', value: 'custom_resource' }]);
  });

  it('should promote blessed resources and exclude specified ones', () => {
    const resources: MetricFindValue[] = [
      { text: 'custom_resource', value: 'custom_resource' },
      { text: 'k8s_cluster_name', value: 'k8s_cluster_name' },
    ];
    const excluded: string[] = ['k8s_cluster_name'];

    const result = sortResources(resources, excluded);

    expect(result).toEqual([{ text: 'custom_resource', value: 'custom_resource' }]);
  });
});

describe('limitOtelMatchTerms', () => {
  it('should limit the OTel match terms if the total match term character count exceeds 2000', () => {
    // the initial match is 1980 characters
    const promMatchTerms: string[] = [
      `${[...Array(1979).keys()]
        .map((el) => {
          return '0';
        })
        .join('')}"`,
    ];
    // job=~"" is 7 chars
    // instance=~"" is 12 characters

    // 7 + 12 + 1979 = 1998
    // so we have room to add 2 more characters
    // attribute values that are b will be left out
    const jobs = ['a', 'b', 'c'];
    const instances = ['d', 'e', 'f'];

    const result = limitOtelMatchTerms(promMatchTerms, jobs, instances);

    expect(result.missingOtelTargets).toEqual(true);
    expect(result.jobsRegex).toEqual(`job=~'a'`);
    expect(result.instancesRegex).toEqual(`instance=~'d'`);
  });

  it('should include | char in the count', () => {
    // the initial match is 1980 characters
    const promMatchTerms: string[] = [
      `${[...Array(1975).keys()]
        .map((el) => {
          return '0';
        })
        .join('')}"`,
    ];
    // job=~"" is 7 chars
    // instance=~"" is 12 characters

    // 7 + 12 + 1975 = 1994
    // so we have room to add 6 more characters
    // the extra 6 characters will be 'a|b' and 'd|e'
    const jobs = ['a', 'b', 'c'];
    const instances = ['d', 'e', 'f'];

    const result = limitOtelMatchTerms(promMatchTerms, jobs, instances);

    expect(result.missingOtelTargets).toEqual(true);
    expect(result.jobsRegex).toEqual(`job=~'a|b'`);
    expect(result.instancesRegex).toEqual(`instance=~'d|e'`);
  });

  it('should add all OTel job and instance matches if the character count is less that 2000', () => {
    const promMatchTerms: string[] = [];

    const jobs = ['job1', 'job2', 'job3', 'job4', 'job5'];

    const instances = ['instance1', 'instance2', 'instance3', 'instance4', 'instance5'];

    const result = limitOtelMatchTerms(promMatchTerms, jobs, instances);

    expect(result.missingOtelTargets).toEqual(false);
    expect(result.jobsRegex).toEqual(`job=~'job1|job2|job3|job4|job5'`);
    expect(result.instancesRegex).toEqual(`instance=~'instance1|instance2|instance3|instance4|instance5'`);
  });
});

describe('updateOtelJoinWithGroupLeft', () => {
  let trail: DataTrail;
  const preTrailUrl =
    '/trail?from=now-1h&to=now&var-ds=edwxqcebl0cg0c&var-deployment_environment=oteldemo01&var-otel_resources=k8s_cluster_name%7C%3D%7Cappo11ydev01&var-filters=&refresh=&metricPrefix=all&metricSearch=http&actionView=breakdown&var-groupby=$__all&metric=http_client_duration_milliseconds_bucket';

  function getOtelJoinQueryVar(trail: DataTrail) {
    const variable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, trail);
    if (variable instanceof ConstantVariable) {
      return variable;
    }
    throw new Error('getDepEnvVar failed');
  }

  beforeEach(() => {
    jest.spyOn(DataTrail.prototype, 'checkDataSourceForOTelResources').mockImplementation(() => Promise.resolve());
    setupDataSources(
      mockDataSource({
        name: 'Prometheus',
        type: DataSourceType.Prometheus,
      })
    );
    trail = new DataTrail({
      useOtelExperience: true,
      nonPromotedOtelResources: ['service_name'],
    });
    locationService.push(preTrailUrl);
    activateFullSceneTree(trail);
  });

  it('should update OTel join query with the group left resource attributes', async () => {
    await updateOtelJoinWithGroupLeft(trail, 'metric');
    const otelJoinQueryVar = getOtelJoinQueryVar(trail);
    // this will include the group left resource attributes
    expect(otelJoinQueryVar.getValue()).toBe(
      '* on (job, instance) group_left(resourceAttribute) topk by (job, instance) (1, target_info{})'
    );
  });

  it('should not update OTel join query with the group left resource attributes when the metric is target_info', async () => {
    await updateOtelJoinWithGroupLeft(trail, 'target_info');
    const otelJoinQueryVar = getOtelJoinQueryVar(trail);
    const emptyGroupLeftClause = 'group_left()';
    const otelJoinQuery = otelJoinQueryVar.state.value;
    if (typeof otelJoinQuery === 'string') {
      expect(otelJoinQuery.includes(emptyGroupLeftClause)).toBe(true);
    }
  });
});

describe('getProdOrDefaultEnv', () => {
  it('should return the value of the option containing "prod"', () => {
    const options = ['test1', 'prod2', 'test3'];

    expect(getProdOrDefaultEnv(options)).toBe('prod2');
  });

  it('should return the first option value if no option contains "prod"', () => {
    const options = ['test1', 'test2', 'test3'];

    expect(getProdOrDefaultEnv(options)).toBe('test1');
  });

  it('should handle case insensitivity', () => {
    const options = ['test1', 'PROD2', 'test3'];

    expect(getProdOrDefaultEnv(options)).toBe('PROD2');
  });

  it('should return null if the options array is empty', () => {
    const options: string[] = [];
    expect(getProdOrDefaultEnv(options)).toBeNull();
  });

  it('should return the first option value if the options array has one element', () => {
    const options = ['test1'];
    expect(getProdOrDefaultEnv(options)).toBe('test1');
  });
});

describe('util functions that rely on trail and variable setup', () => {
  beforeAll(() => {
    jest.spyOn(DataTrail.prototype, 'checkDataSourceForOTelResources').mockImplementation(() => Promise.resolve());

    setupDataSources(
      mockDataSource({
        name: 'Prometheus',
        type: DataSourceType.Prometheus,
      })
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  let trail: DataTrail;
  const defaultTimeRange = { from: 'now-1h', to: 'now' };
  // selecting a non promoted resource from VAR_OTEL_AND_METRICS will automatically update the otel resources var
  const nonPromotedOtelResources = ['deployment_environment'];
  const preTrailUrl =
    '/trail?from=now-1h&to=now&var-ds=edwxqcebl0cg0c&var-deployment_environment=oteldemo01&var-otel_resources=k8s_cluster_name%7C%3D%7Cappo11ydev01&var-filters=&refresh=&metricPrefix=all&metricSearch=http&actionView=breakdown&var-groupby=$__all&metric=http_client_duration_milliseconds_bucket';

  function getOtelAndMetricsVar(trail: DataTrail) {
    const variable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);
    if (variable instanceof AdHocFiltersVariable) {
      return variable;
    }
    throw new Error('getOtelAndMetricsVar failed');
  }

  function getOtelResourcesVar(trail: DataTrail) {
    const variable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, trail);
    if (variable instanceof AdHocFiltersVariable) {
      return variable;
    }
    throw new Error('getOtelResourcesVar failed');
  }

  function getOtelGroupLeftVar(trail: DataTrail) {
    const variable = sceneGraph.lookupVariable(VAR_OTEL_GROUP_LEFT, trail);
    if (variable instanceof ConstantVariable) {
      return variable;
    }
    throw new Error('getOtelGroupLeftVar failed');
  }

  function getFilterVar() {
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, trail);
    if (variable instanceof AdHocFiltersVariable) {
      return variable;
    }
    throw new Error('getFilterVar failed');
  }

  beforeEach(() => {
    trail = new DataTrail({
      useOtelExperience: true,
      nonPromotedOtelResources,
    });
    setupDataSources(
      mockDataSource({
        name: 'Prometheus',
        type: DataSourceType.Prometheus,
      })
    );
    locationService.push(preTrailUrl);
    activateFullSceneTree(trail);
    getOtelGroupLeftVar(trail).setState({ value: 'attribute1,attribute2' });
  });

  afterEach(() => {
    trail.setState({ initialOtelCheckComplete: false });
  });
  describe('updateOtelData', () => {
    it('should automatically add the deployment environment on loading a data trail from start', () => {
      trail.setState({ startButtonClicked: true });
      const autoSelectedDepEnvValue = 'production';
      const deploymentEnvironments = [autoSelectedDepEnvValue];
      updateOtelData(
        trail,
        'datasourceUid',
        defaultTimeRange,
        deploymentEnvironments,
        true, // hasOtelResources
        nonPromotedOtelResources
      );
      const otelMetricsVar = getOtelAndMetricsVar(trail);
      const otelMetricsKey = otelMetricsVar.state.filters[0].key;
      const otelMetricsValue = otelMetricsVar.state.filters[0].value;

      const otelResourcesVar = getOtelResourcesVar(trail);
      const otelResourcesKey = otelResourcesVar.state.filters[0].key;
      const otelResourcesValue = otelResourcesVar.state.filters[0].value;

      expect(otelMetricsKey).toBe('deployment_environment');
      expect(otelMetricsValue).toBe(autoSelectedDepEnvValue);

      expect(otelResourcesKey).toBe('deployment_environment');
      expect(otelResourcesValue).toBe(autoSelectedDepEnvValue);
    });

    it('should use the deployment environment from url when loading a trail and not automatically load it', () => {
      const autoSelectedDeploymentEnvironmentValue = 'production';
      const deploymentEnvironments = [autoSelectedDeploymentEnvironmentValue];
      // the url loads the deployment environment into otelmetricsvar
      const prevUrlDepEnvValue = 'from_url';
      getOtelAndMetricsVar(trail).setState({
        filters: [{ key: 'deployment_environment', operator: '=', value: prevUrlDepEnvValue }],
      });

      updateOtelData(
        trail,
        'datasourceUid',
        defaultTimeRange,
        deploymentEnvironments,
        true, // hasOtelResources
        nonPromotedOtelResources
      );
      const otelMetricsVar = getOtelAndMetricsVar(trail);
      const otelMetricsKey = otelMetricsVar.state.filters[0].key;
      const otelMetricsValue = otelMetricsVar.state.filters[0].value;

      const otelResourcesVar = getOtelResourcesVar(trail);
      const otelResourcesKey = otelResourcesVar.state.filters[0].key;
      const otelResourcesValue = otelResourcesVar.state.filters[0].value;

      expect(otelMetricsKey).toBe('deployment_environment');
      expect(otelMetricsValue).toBe(prevUrlDepEnvValue);

      expect(otelResourcesKey).toBe('deployment_environment');
      expect(otelResourcesValue).toBe(prevUrlDepEnvValue);
    });

    it('should load all filters based on the url for VAR_OTEL_AND_METRICS_FILTERS on initial load', () => {
      const nonPromotedOtelResources = ['deployment_environment', 'resource'];
      const depEnvFilter = { key: 'deployment_environment', operator: '=', value: 'from_url' };
      const otelResourceFilter = { key: 'resource', operator: '=', value: 'resource' };
      const promotedFilter = { key: 'promoted', operator: '=', value: 'promoted' };
      const metricFilter = { key: 'metric', operator: '=', value: 'metric' };

      getOtelAndMetricsVar(trail).setState({
        filters: [depEnvFilter, otelResourceFilter, promotedFilter, metricFilter],
      });

      updateOtelData(
        trail,
        'datasourceUid',
        defaultTimeRange,
        ['production'],
        true, // hasOtelResources
        nonPromotedOtelResources
      );

      const otelMetricsVar = getOtelAndMetricsVar(trail);
      const otelResourcesVar = getOtelResourcesVar(trail);
      const varFilters = getFilterVar();

      // otelmetrics var will contain all three
      expect(otelMetricsVar.state.filters).toEqual([depEnvFilter, otelResourceFilter, promotedFilter, metricFilter]);
      // otel resources will contain only non promoted
      expect(otelResourcesVar.state.filters).toEqual([depEnvFilter, otelResourceFilter]);
      // var filters will contain promoted and metric labels
      expect(varFilters.state.filters).toEqual([promotedFilter, metricFilter]);
    });

    it('should not automatically add the deployment environment on loading a data trail when there are no deployment environments in the data source', () => {
      // no dep env values found in the data source
      const deploymentEnvironments: string[] = [];
      updateOtelData(
        trail,
        'datasourceUid',
        defaultTimeRange,
        deploymentEnvironments,
        true, // hasOtelResources
        nonPromotedOtelResources
      );
      const otelMetricsVar = getOtelAndMetricsVar(trail);

      const otelResourcesVar = getOtelResourcesVar(trail);

      expect(otelMetricsVar.state.filters.length).toBe(0);
      expect(otelResourcesVar.state.filters.length).toBe(0);
    });

    it('should not automatically add the deployment environment on loading a data trail when loading from url and no dep env are present in the filters', () => {
      // not from start
      // no dep env values found in the data source
      const deploymentEnvironments: string[] = [];
      updateOtelData(
        trail,
        'datasourceUid',
        defaultTimeRange,
        deploymentEnvironments,
        true, // hasOtelResources
        nonPromotedOtelResources
      );
      const otelMetricsVar = getOtelAndMetricsVar(trail);

      const otelResourcesVar = getOtelResourcesVar(trail);

      expect(otelMetricsVar.state.filters.length).toBe(0);
      expect(otelResourcesVar.state.filters.length).toBe(0);
    });

    it('should add the deployment environment to var filters if it has been promoted from start', () => {
      trail.setState({ startButtonClicked: true });
      // the deployment environment has been promoted to a metric label
      const deploymentEnvironments = ['production'];
      updateOtelData(
        trail,
        'datasourceUid',
        defaultTimeRange,
        deploymentEnvironments,
        true, // hasOtelResources
        [] //nonPromotedOtelResources
      );
      const varFilters = getFilterVar().state.filters[0];
      expect(varFilters.key).toBe('deployment_environment');
      expect(varFilters.value).toBe('production');
    });

    it('should preserve var filters when switching a data source but not initial load', () => {
      trail.setState({ initialOtelCheckComplete: true });
      const deploymentEnvironments = ['production'];
      getFilterVar().setState({ filters: [{ key: 'zone', operator: '=', value: 'a' }] });
      updateOtelData(
        trail,
        'datasourceUid',
        defaultTimeRange,
        deploymentEnvironments,
        true, // hasOtelResources
        nonPromotedOtelResources
      );
      const varFilters = getFilterVar().state.filters[0];
      expect(varFilters.key).toBe('zone');
      expect(varFilters.value).toBe('a');
    });
  });

  describe('manageOtelAndMetricFilters', () => {
    it('should add a new filter to otel filters when VAR_OTEL_AND_METRIC_FILTERS is updated', () => {
      const newStateFilters: AdHocVariableFilter[] = [{ key: 'otel_key', value: 'value', operator: '=' }];
      const prevStateFilters: AdHocVariableFilter[] = [];

      const nonPromotedOtelResources = ['otel_key'];

      const otelFiltersVariable = getOtelResourcesVar(trail);

      const filtersVariable = getFilterVar();

      manageOtelAndMetricFilters(
        newStateFilters,
        prevStateFilters,
        nonPromotedOtelResources,
        otelFiltersVariable,
        filtersVariable
      );

      expect(otelFiltersVariable.state.filters).toEqual(newStateFilters);
    });

    it('should add a new filter to metric filters when VAR_OTEL_AND_METRIC_FILTERS is updated', () => {
      const newStateFilters: AdHocVariableFilter[] = [{ key: 'metric_key', value: 'value', operator: '=' }];
      const prevStateFilters: AdHocVariableFilter[] = [];

      const nonPromotedOtelResources = ['otel_key'];

      const otelFiltersVariable = getOtelResourcesVar(trail);

      const filtersVariable = getFilterVar();

      manageOtelAndMetricFilters(
        newStateFilters,
        prevStateFilters,
        nonPromotedOtelResources,
        otelFiltersVariable,
        filtersVariable
      );

      expect(filtersVariable.state.filters).toEqual(newStateFilters);
    });

    it('should remove a filter from otel filters when VAR_OTEL_AND_METRIC_FILTERS is updated', () => {
      const newStateFilters: AdHocVariableFilter[] = [];
      const prevStateFilters: AdHocVariableFilter[] = [{ key: 'otel_key', value: 'value', operator: '=' }];

      const nonPromotedOtelResources = ['otel_key'];

      const otelFiltersVariable = getOtelResourcesVar(trail);

      const filtersVariable = getFilterVar();

      manageOtelAndMetricFilters(
        newStateFilters,
        prevStateFilters,
        nonPromotedOtelResources,
        otelFiltersVariable,
        filtersVariable
      );

      expect(otelFiltersVariable.state.filters).toEqual(newStateFilters);
    });

    it('should remove a filter from metric filters when VAR_OTEL_AND_METRIC_FILTERS is updated', () => {
      const newStateFilters: AdHocVariableFilter[] = [];
      const prevStateFilters: AdHocVariableFilter[] = [{ key: 'metric_key', value: 'value', operator: '=' }];

      const nonPromotedOtelResources = ['otel_key'];

      const otelFiltersVariable = getOtelResourcesVar(trail);

      const filtersVariable = getFilterVar();
      filtersVariable.setState({ filters: [{ key: 'metric_key', value: 'value', operator: '=' }] });

      manageOtelAndMetricFilters(
        newStateFilters,
        prevStateFilters,
        nonPromotedOtelResources,
        otelFiltersVariable,
        filtersVariable
      );

      expect(filtersVariable.state.filters).toEqual(newStateFilters);
    });

    it('should update a filter in otel filters when VAR_OTEL_AND_METRIC_FILTERS is updated', () => {
      const newStateFilters: AdHocVariableFilter[] = [{ key: 'otel_key', value: 'new_value', operator: '=' }];
      const prevStateFilters: AdHocVariableFilter[] = [{ key: 'otel_key', value: 'old_value', operator: '=' }];

      const nonPromotedOtelResources = ['otel_key'];

      const otelFiltersVariable = getOtelResourcesVar(trail);
      otelFiltersVariable.setState({ filters: [{ key: 'otel_key', value: 'old_value', operator: '=' }] });

      const filtersVariable = getFilterVar();

      manageOtelAndMetricFilters(
        newStateFilters,
        prevStateFilters,
        nonPromotedOtelResources,
        otelFiltersVariable,
        filtersVariable
      );

      expect(otelFiltersVariable.state.filters).toEqual(newStateFilters);
    });

    it('should update a filter in metric filters when VAR_OTEL_AND_METRIC_FILTERS is updated', () => {
      const newStateFilters: AdHocVariableFilter[] = [{ key: 'metric_key', value: 'new_value', operator: '=' }];
      const prevStateFilters: AdHocVariableFilter[] = [{ key: 'metric_key', value: 'old_value', operator: '=' }];

      const nonPromotedOtelResources = ['otel_key'];

      const otelFiltersVariable = getOtelResourcesVar(trail);

      const filtersVariable = getFilterVar();
      filtersVariable.setState({ filters: [{ key: 'metric_key', value: 'old_value', operator: '=' }] });

      manageOtelAndMetricFilters(
        newStateFilters,
        prevStateFilters,
        nonPromotedOtelResources,
        otelFiltersVariable,
        filtersVariable
      );

      expect(filtersVariable.state.filters).toEqual(newStateFilters);
    });
  });
});
