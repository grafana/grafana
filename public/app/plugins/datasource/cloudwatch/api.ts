import { memoize } from 'lodash';

import { DataSourceInstanceSettings, SelectableValue, toOption } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { CloudWatchRequest } from './query-runner/CloudWatchRequest';
import {
  CloudWatchJsonData,
  DescribeLogGroupsRequest,
  GetDimensionKeysRequest,
  GetDimensionValuesRequest,
  GetMetricsRequest,
  MetricResponse,
  MultiFilters,
  Account,
} from './types';

export interface SelectableResourceValue extends SelectableValue<string> {
  text: string;
}

export class CloudWatchAPI extends CloudWatchRequest {
  private memoizedGetRequest;

  constructor(instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>, templateSrv: TemplateSrv) {
    super(instanceSettings, templateSrv);
    this.memoizedGetRequest = memoize(this.getRequest.bind(this), (path, parameters) =>
      JSON.stringify({ path, parameters })
    );
  }

  private getRequest<T>(subtype: string, parameters?: Record<string, string | string[] | number>): Promise<T> {
    return getBackendSrv().get(`/api/datasources/${this.instanceSettings.id}/resources/${subtype}`, parameters);
  }

  getAccounts(region: string): Promise<Account[]> {
    return getBackendSrv().get(`/api/datasources/${this.instanceSettings.id}/resources/accounts`, {
      region: this.templateSrv.replace(region),
    });
  }

  getRegions() {
    return this.memoizedGetRequest<SelectableResourceValue[]>('regions').then((regions) => [
      { label: 'default', value: 'default', text: 'default' },
      ...regions.filter((r) => r.value),
    ]);
  }

  getNamespaces() {
    return this.memoizedGetRequest<string[]>('namespaces').then((namespaces) =>
      namespaces.map((n) => ({ label: n, value: n }))
    );
  }

  async describeLogGroups(params: DescribeLogGroupsRequest) {
    return this.memoizedGetRequest<SelectableResourceValue[]>('log-groups', {
      ...params,
      region: this.templateSrv.replace(this.getActualRegion(params.region)),
    });
  }

  async describeAllLogGroups(params: DescribeLogGroupsRequest) {
    return this.memoizedGetRequest<SelectableResourceValue[]>('all-log-groups', {
      ...params,
      region: this.templateSrv.replace(this.getActualRegion(params.region)),
    });
  }

  async getMetrics({ region, namespace }: GetMetricsRequest): Promise<Array<SelectableValue<string>>> {
    if (!namespace) {
      return [];
    }

    return this.memoizedGetRequest<MetricResponse[]>('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
    }).then((metrics) => metrics.map((m) => ({ label: m.name, value: m.name })));
  }

  async getAllMetrics({ region }: GetMetricsRequest): Promise<Array<{ metricName?: string; namespace: string }>> {
    return this.memoizedGetRequest<MetricResponse[]>('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
    }).then((metrics) => metrics.map((m) => ({ metricName: m.name, namespace: m.namespace })));
  }

  async getDimensionKeys({
    region,
    namespace = '',
    dimensionFilters = {},
    metricName = '',
  }: GetDimensionKeysRequest): Promise<Array<SelectableValue<string>>> {
    return this.memoizedGetRequest<string[]>('dimension-keys', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      dimensionFilters: JSON.stringify(this.convertDimensionFormat(dimensionFilters, {})),
      metricName,
    }).then((dimensionKeys) => dimensionKeys.map(toOption));
  }

  async getDimensionValues({
    dimensionKey,
    region,
    namespace,
    dimensionFilters = {},
    metricName = '',
  }: GetDimensionValuesRequest) {
    if (!namespace || !metricName) {
      return [];
    }

    const values = await this.memoizedGetRequest<string[]>('dimension-values', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      metricName: this.templateSrv.replace(metricName.trim()),
      dimensionKey: this.templateSrv.replace(dimensionKey),
      dimensionFilters: JSON.stringify(this.convertDimensionFormat(dimensionFilters, {})),
    }).then((dimensionValues) => dimensionValues.map(toOption));

    return values;
  }

  getEbsVolumeIds(region: string, instanceId: string) {
    return this.memoizedGetRequest<SelectableResourceValue[]>('ebs-volume-ids', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      instanceId: this.templateSrv.replace(instanceId),
    });
  }

  getEc2InstanceAttribute(region: string, attributeName: string, filters: MultiFilters) {
    return this.memoizedGetRequest<SelectableResourceValue[]>('ec2-instance-attribute', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      attributeName: this.templateSrv.replace(attributeName),
      filters: JSON.stringify(this.convertMultiFilterFormat(filters, 'filter key')),
    });
  }

  getResourceARNs(region: string, resourceType: string, tags: MultiFilters) {
    return this.memoizedGetRequest<SelectableResourceValue[]>('resource-arns', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      resourceType: this.templateSrv.replace(resourceType),
      tags: JSON.stringify(this.convertMultiFilterFormat(tags, 'tag name')),
    });
  }
}
