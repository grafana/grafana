import { memoize } from 'lodash';

import { DataSourceInstanceSettings, SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { CloudWatchRequest } from './query-runner/CloudWatchRequest';
import {
  CloudWatchJsonData,
  DescribeLogGroupsRequest,
  GetDimensionKeysRequest,
  GetDimensionValuesRequest,
  GetMetricsRequest,
  LogGroupResponse,
  MetricResponse,
  MultiFilters,
  Account,
  ResourceRequest,
  ResourceResponse,
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

  getAccounts({ region }: ResourceRequest): Promise<Account[]> {
    return this.memoizedGetRequest<Array<ResourceResponse<Account>>>('accounts', {
      region: this.templateSrv.replace(region),
    }).then((accounts) => accounts.map((a) => a.value));
  }

  isMonitoringAccount(region: string): Promise<boolean> {
    return this.getAccounts({ region })
      .then((accounts) => accounts.some((account) => account.isMonitoringAccount))
      .catch(() => false);
  }

  getRegions() {
    return this.memoizedGetRequest<SelectableResourceValue[]>('regions').then((regions) => [
      { label: 'default', value: 'default', text: 'default' },
      ...regions.filter((r) => r.value),
    ]);
  }

  getNamespaces() {
    return this.memoizedGetRequest<Array<ResourceResponse<string>>>('namespaces').then((namespaces) =>
      namespaces.map((n) => ({ label: n.value, value: n.value }))
    );
  }

  async describeLogGroups(params: DescribeLogGroupsRequest) {
    return this.memoizedGetRequest<SelectableResourceValue[]>('log-groups', {
      ...params,
      region: this.templateSrv.replace(this.getActualRegion(params.region)),
    });
  }

  async describeCrossAccountLogGroups(params: DescribeLogGroupsRequest): Promise<SelectableResourceValue[]> {
    return this.memoizedGetRequest<Array<ResourceResponse<LogGroupResponse>>>('describe-log-groups', {
      ...params,
      region: this.templateSrv.replace(this.getActualRegion(params.region)),
      accountId: this.templateSrv.replace(params.accountId),
    }).then((resourceResponse) =>
      resourceResponse.map((resource) => ({
        label: resource.value.name,
        value: resource.value.arn,
        text: resource.accountId || '',
      }))
    );
  }

  async describeAllLogGroups(params: DescribeLogGroupsRequest) {
    return this.memoizedGetRequest<SelectableResourceValue[]>('all-log-groups', {
      ...params,
      region: this.templateSrv.replace(this.getActualRegion(params.region)),
    });
  }

  async getMetrics({ region, namespace, accountId }: GetMetricsRequest): Promise<Array<SelectableValue<string>>> {
    if (!namespace) {
      return [];
    }

    return this.memoizedGetRequest<Array<ResourceResponse<MetricResponse>>>('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      accountId: this.templateSrv.replace(accountId),
    }).then((metrics) => metrics.map((m) => ({ label: m.value.name, value: m.value.name })));
  }

  async getAllMetrics({
    region,
    accountId,
  }: GetMetricsRequest): Promise<Array<{ metricName?: string; namespace: string }>> {
    return this.memoizedGetRequest<Array<ResourceResponse<MetricResponse>>>('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      accountId: this.templateSrv.replace(accountId),
    }).then((metrics) => metrics.map((m) => ({ metricName: m.value.name, namespace: m.value.namespace })));
  }

  async getDimensionKeys({
    region,
    namespace = '',
    dimensionFilters = {},
    metricName = '',
    accountId,
  }: GetDimensionKeysRequest): Promise<Array<SelectableValue<string>>> {
    return this.memoizedGetRequest<Array<ResourceResponse<string>>>('dimension-keys', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      accountId: this.templateSrv.replace(accountId),
      metricName: this.templateSrv.replace(metricName),
      dimensionFilters: JSON.stringify(this.convertDimensionFormat(dimensionFilters, {})),
    }).then((r) => r.map((r) => ({ label: r.value, value: r.value })));
  }

  async getDimensionValues({
    dimensionKey,
    region,
    namespace,
    dimensionFilters = {},
    metricName = '',
    accountId,
  }: GetDimensionValuesRequest) {
    if (!namespace || !metricName) {
      return [];
    }

    const values = await this.memoizedGetRequest<Array<ResourceResponse<string>>>('dimension-values', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      metricName: this.templateSrv.replace(metricName.trim()),
      dimensionKey: this.templateSrv.replace(dimensionKey),
      dimensionFilters: JSON.stringify(this.convertDimensionFormat(dimensionFilters, {})),
      accountId: this.templateSrv.replace(accountId),
    }).then((r) => r.map((r) => ({ label: r.value, value: r.value })));
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
