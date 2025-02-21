import { memoize } from 'lodash';

import { DataSourceInstanceSettings, SelectableValue } from '@grafana/data';
import { getBackendSrv, TemplateSrv } from '@grafana/runtime';

import { CloudWatchRequest } from '../query-runner/CloudWatchRequest';
import { CloudWatchJsonData, LogGroupField, MultiFilters } from '../types';

import {
  ResourceRequest,
  Account,
  ResourceResponse,
  DescribeLogGroupsRequest,
  LogGroupResponse,
  GetMetricsRequest,
  GetDimensionKeysRequest,
  GetDimensionValuesRequest,
  MetricResponse,
  SelectableResourceValue,
  RegionResponse,
} from './types';

export class ResourcesAPI extends CloudWatchRequest {
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

  async getExternalId(): Promise<string> {
    return await this.memoizedGetRequest<{ externalId: string }>('external-id').then(({ externalId }) => externalId);
  }

  getAccounts({ region }: ResourceRequest): Promise<Account[]> {
    return this.memoizedGetRequest<Array<ResourceResponse<Account>>>('accounts', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
    }).then((accounts) => accounts.map((a) => a.value));
  }

  isMonitoringAccount(region: string): Promise<boolean> {
    return this.getAccounts({ region })
      .then((accounts) => accounts.some((account) => account.isMonitoringAccount))
      .catch(() => false);
  }

  getRegions(): Promise<SelectableResourceValue[]> {
    return this.memoizedGetRequest<Array<ResourceResponse<RegionResponse>>>('regions').then((regions) => {
      return [
        { label: 'default', value: 'default', text: 'default' },
        ...regions.map((r) => ({
          label: r.value.name,
          value: r.value.name,
          text: r.value.name,
        })),
      ].filter((r) => r.value);
    });
  }

  getNamespaces() {
    return this.memoizedGetRequest<Array<ResourceResponse<string>>>('namespaces').then((namespaces) =>
      namespaces.map((n) => ({ label: n.value, value: n.value }))
    );
  }

  getLogGroups(params: DescribeLogGroupsRequest): Promise<Array<ResourceResponse<LogGroupResponse>>> {
    return this.memoizedGetRequest<Array<ResourceResponse<LogGroupResponse>>>('log-groups', {
      ...params,
      region: this.templateSrv.replace(this.getActualRegion(params.region)),
      accountId: this.templateSrv.replace(params.accountId),
      listAllLogGroups: params.listAllLogGroups ? 'true' : 'false',
    });
  }

  getLogGroupFields(region: string, logGroupName: string): Promise<Array<ResourceResponse<LogGroupField>>> {
    return this.memoizedGetRequest<Array<ResourceResponse<LogGroupField>>>('log-group-fields', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      logGroupName: logGroupName,
    });
  }

  getMetrics({ region, namespace, accountId }: GetMetricsRequest): Promise<Array<SelectableValue<string>>> {
    if (!namespace) {
      return Promise.resolve([]);
    }

    return this.memoizedGetRequest<Array<ResourceResponse<MetricResponse>>>('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      accountId: this.templateSrv.replace(accountId),
    }).then((metrics) => metrics.map((m) => ({ label: m.value.name, value: m.value.name })));
  }

  getAllMetrics({ region, accountId }: GetMetricsRequest): Promise<Array<{ metricName?: string; namespace: string }>> {
    return this.memoizedGetRequest<Array<ResourceResponse<MetricResponse>>>('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      accountId: this.templateSrv.replace(accountId),
    }).then((metrics) => metrics.map((m) => ({ metricName: m.value.name, namespace: m.value.namespace })));
  }

  getDimensionKeys(
    { region, namespace = '', dimensionFilters = {}, metricName = '', accountId }: GetDimensionKeysRequest,
    displayErrorIfIsMultiTemplateVariable?: boolean
  ): Promise<Array<SelectableValue<string>>> {
    return this.memoizedGetRequest<Array<ResourceResponse<string>>>('dimension-keys', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      accountId: this.templateSrv.replace(accountId),
      metricName: this.templateSrv.replace(metricName),
      dimensionFilters: JSON.stringify(
        this.convertDimensionFormat(dimensionFilters, {}, displayErrorIfIsMultiTemplateVariable)
      ),
    }).then((r) => r.map((r) => ({ label: r.value, value: r.value })));
  }

  getDimensionValues({
    dimensionKey,
    region,
    namespace,
    dimensionFilters = {},
    metricName = '',
    accountId,
  }: GetDimensionValuesRequest) {
    if (!namespace || !metricName) {
      return Promise.resolve([]);
    }

    return this.memoizedGetRequest<Array<ResourceResponse<string>>>('dimension-values', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      metricName: this.templateSrv.replace(metricName.trim()),
      dimensionKey: this.replaceVariableAndDisplayWarningIfMulti(dimensionKey, {}, true),
      dimensionFilters: JSON.stringify(this.convertDimensionFormat(dimensionFilters, {})),
      accountId: this.templateSrv.replace(accountId),
    }).then((r) => r.map((r) => ({ label: r.value, value: r.value })));
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

  legacyDescribeLogGroups(region: string, logGroupNamePrefix?: string) {
    return this.memoizedGetRequest<SelectableResourceValue[]>('legacy-log-groups', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      logGroupNamePrefix: logGroupNamePrefix || '',
    });
  }
}
