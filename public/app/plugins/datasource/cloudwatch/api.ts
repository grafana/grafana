import { memoize } from 'lodash';

import { DataSourceInstanceSettings, SelectableValue, toOption } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { CloudWatchRequest } from './query-runner/CloudWatchRequest';
import { CloudWatchJsonData, DescribeLogGroupsRequest, GetDimensionKeysRequest, MultiFilters } from './types';

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

  getRegions() {
    return this.memoizedGetRequest<SelectableResourceValue[]>('regions').then((regions) => [
      { label: 'default', value: 'default', text: 'default' },
      ...regions.filter((r) => r.value),
    ]);
  }

  getNamespaces() {
    return this.memoizedGetRequest<SelectableResourceValue[]>('namespaces');
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

  async getMetrics(namespace: string | undefined, region?: string) {
    if (!namespace) {
      return [];
    }

    return this.memoizedGetRequest<SelectableResourceValue[]>('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
    });
  }

  async getAllMetrics(region: string): Promise<Array<{ metricName?: string; namespace: string }>> {
    const values = await this.memoizedGetRequest<SelectableResourceValue[]>('all-metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
    });

    return values.map((v) => ({ metricName: v.value, namespace: v.text }));
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

  async getDimensionValues(
    region: string,
    namespace: string | undefined,
    metricName: string | undefined,
    dimensionKey: string,
    filterDimensions: {}
  ) {
    if (!namespace || !metricName) {
      return [];
    }

    const values = await this.memoizedGetRequest<SelectableResourceValue[]>('dimension-values', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      metricName: this.templateSrv.replace(metricName.trim()),
      dimensionKey: this.templateSrv.replace(dimensionKey),
      dimensions: JSON.stringify(this.convertDimensionFormat(filterDimensions, {})),
    });

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
