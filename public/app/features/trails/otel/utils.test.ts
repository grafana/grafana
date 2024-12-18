import { MetricFindValue } from '@grafana/data';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, ConstantVariable, CustomVariable, sceneGraph } from '@grafana/scenes';
import { mockDataSource, MockDataSourceSrv } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';

import { DataTrail } from '../DataTrail';
import { VAR_OTEL_DEPLOYMENT_ENV, VAR_OTEL_GROUP_LEFT, VAR_OTEL_JOIN_QUERY, VAR_OTEL_RESOURCES } from '../shared';

import {
  sortResources,
  getOtelJoinQuery,
  blessedList,
  limitOtelMatchTerms,
  updateOtelJoinWithGroupLeft,
  getProdOrDefaultOption,
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

  it('should return an empty string if filters or labels are missing', () => {
    const otelResourcesObject = {
      filters: '',
      labels: '',
    };

    const result = getOtelJoinQuery(otelResourcesObject);

    expect(result).toBe('');
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

  it('should return an empty string if filters or labels are missing', () => {
    const otelResourcesObject = {
      filters: '',
      labels: '',
    };

    const result = getOtelJoinQuery(otelResourcesObject);

    expect(result).toBe('');
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

  function getOtelDepEnvVar(trail: DataTrail) {
    const variable = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, trail);
    if (variable instanceof CustomVariable) {
      return variable;
    }
    throw new Error('getDepEnvVar failed');
  }

  function getOtelJoinQueryVar(trail: DataTrail) {
    const variable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, trail);
    if (variable instanceof ConstantVariable) {
      return variable;
    }
    throw new Error('getDepEnvVar failed');
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
    throw new Error('getOtelResourcesVar failed');
  }

  beforeEach(() => {
    jest.spyOn(DataTrail.prototype, 'checkDataSourceForOTelResources').mockImplementation(() => Promise.resolve());
    setDataSourceSrv(
      new MockDataSourceSrv({
        prom: mockDataSource({
          name: 'Prometheus',
          type: DataSourceType.Prometheus,
        }),
      })
    );
    trail = new DataTrail({});
    locationService.push(preTrailUrl);
    activateFullSceneTree(trail);
    getOtelResourcesVar(trail).setState({ filters: [{ key: 'service_name', operator: '=', value: 'adservice' }] });
    getOtelDepEnvVar(trail).changeValueTo('production');
    getOtelGroupLeftVar(trail).setState({ value: 'attribute1,attribute2' });
  });

  it('should update OTel join query with the group left resource attributes', async () => {
    await updateOtelJoinWithGroupLeft(trail, 'metric');
    const otelJoinQueryVar = getOtelJoinQueryVar(trail);
    // this will include the group left resource attributes
    expect(otelJoinQueryVar.getValue()).toBe(
      '* on (job, instance) group_left(resourceAttribute) topk by (job, instance) (1, target_info{deployment_environment="production",service_name="adservice"})'
    );
  });

  it('should not update OTel join query with the group left resource attributes when the metric is target_info', async () => {
    await updateOtelJoinWithGroupLeft(trail, 'target_info');
    const otelJoinQueryVar = getOtelJoinQueryVar(trail);

    expect(otelJoinQueryVar.getValue()).toBe('');
  });
});

describe('getProdOrDefaultOption', () => {
  it('should return the value of the option containing "prod"', () => {
    const options = [
      { value: 'test1', label: 'Test 1' },
      { value: 'prod2', label: 'Prod 2' },
      { value: 'test3', label: 'Test 3' },
    ];
    expect(getProdOrDefaultOption(options)).toBe('prod2');
  });

  it('should return the first option value if no option contains "prod"', () => {
    const options = [
      { value: 'test1', label: 'Test 1' },
      { value: 'test2', label: 'Test 2' },
      { value: 'test3', label: 'Test 3' },
    ];
    expect(getProdOrDefaultOption(options)).toBe('test1');
  });

  it('should handle case insensitivity', () => {
    const options = [
      { value: 'test1', label: 'Test 1' },
      { value: 'PROD2', label: 'Prod 2' },
      { value: 'test3', label: 'Test 3' },
    ];
    expect(getProdOrDefaultOption(options)).toBe('PROD2');
  });

  it('should return null if the options array is empty', () => {
    const options: Array<{ value: string; label: string }> = [];
    expect(getProdOrDefaultOption(options)).toBeNull();
  });

  it('should return the first option value if the options array has one element', () => {
    const options = [{ value: 'test1', label: 'Test 1' }];
    expect(getProdOrDefaultOption(options)).toBe('test1');
  });
});
