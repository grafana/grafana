import { MetricFindValue } from '@grafana/data';

import { sortResources, getOtelJoinQuery, blessedList } from './util';

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
