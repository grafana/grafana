import { MetricFindValue } from '@grafana/data';

import { sortResources, getOtelJoinQuery, blessedList, limitOtelMatchTerms } from './util';

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
      '* on (job, instance) group_left(deployment_environment,custom_label) topk by (job, instance) (1, target_info{job="test-job",instance="test-instance"})'
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
      '* on (job, instance) group_left(deployment_environment,custom_label) topk by (job, instance) (1, target_info{job="test-job",instance="test-instance"})'
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
    expect(result.jobsRegex).toEqual('job=~"a"');
    expect(result.instancesRegex).toEqual('instance=~"d"');
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
    expect(result.jobsRegex).toEqual('job=~"a|b"');
    expect(result.instancesRegex).toEqual('instance=~"d|e"');
  });

  it('should add all OTel job and instance matches if the character count is less that 2000', () => {
    const promMatchTerms: string[] = [];

    const jobs = ['job1', 'job2', 'job3', 'job4', 'job5'];

    const instances = ['instance1', 'instance2', 'instance3', 'instance4', 'instance5'];

    const result = limitOtelMatchTerms(promMatchTerms, jobs, instances);

    expect(result.missingOtelTargets).toEqual(false);
    expect(result.jobsRegex).toEqual('job=~"job1|job2|job3|job4|job5"');
    expect(result.instancesRegex).toEqual('instance=~"instance1|instance2|instance3|instance4|instance5"');
  });
});
