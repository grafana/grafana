import { DataSourceInstanceSettings, SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { CloudWatchRequest } from './query-runner/CloudWatchRequest';
import { CloudWatchJsonData, DescribeLogGroupsRequest, Dimensions, MultiFilters } from './types';

export interface SelectableResourceValue extends SelectableValue<string> {
  text: string;
}

export class CloudWatchAPI extends CloudWatchRequest {
  constructor(instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>, templateSrv: TemplateSrv) {
    super(instanceSettings, templateSrv);
  }

  resourceRequest(
    subtype: string,
    parameters?: Record<string, string | string[] | number>
  ): Promise<SelectableResourceValue[]> {
    return getBackendSrv().get(`/api/datasources/${this.instanceSettings.id}/resources/${subtype}`, parameters);
  }

  getRegions() {
    return this.resourceRequest('regions').then((regions) => [
      { label: 'default', value: 'default', text: 'default' },
      ...regions.filter((r) => r.value),
    ]);
  }

  getNamespaces() {
    return this.resourceRequest('namespaces');
  }

  async describeLogGroups(params: DescribeLogGroupsRequest) {
    return this.resourceRequest('log-groups', {
      ...params,
      region: this.templateSrv.replace(this.getActualRegion(params.region)),
    });
  }

  async describeAllLogGroups(params: DescribeLogGroupsRequest) {
    return this.resourceRequest('all-log-groups', {
      ...params,
      region: this.templateSrv.replace(this.getActualRegion(params.region)),
    });
  }

  async getMetrics(namespace: string | undefined, region?: string) {
    if (!namespace) {
      return [];
    }

    return this.resourceRequest('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
    });
  }

  async getAllMetrics(region: string): Promise<Array<{ metricName?: string; namespace: string }>> {
    const values = await this.resourceRequest('all-metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
    });

    return values.map((v) => ({ metricName: v.value, namespace: v.text }));
  }

  async getDimensionKeys(
    namespace: string | undefined,
    region: string,
    dimensionFilters: Dimensions = {},
    metricName = ''
  ) {
    if (!namespace) {
      return [];
    }

    return this.resourceRequest('dimension-keys', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      dimensionFilters: JSON.stringify(this.convertDimensionFormat(dimensionFilters, {})),
      metricName,
    });
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

    const values = await this.resourceRequest('dimension-values', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      metricName: this.templateSrv.replace(metricName.trim()),
      dimensionKey: this.templateSrv.replace(dimensionKey),
      dimensions: JSON.stringify(this.convertDimensionFormat(filterDimensions, {})),
    });

    return values;
  }

  getEbsVolumeIds(region: string, instanceId: string) {
    return this.resourceRequest('ebs-volume-ids', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      instanceId: this.templateSrv.replace(instanceId),
    });
  }

  getEc2InstanceAttribute(region: string, attributeName: string, filters: MultiFilters) {
    return this.resourceRequest('ec2-instance-attribute', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      attributeName: this.templateSrv.replace(attributeName),
      filters: JSON.stringify(this.convertMultiFilterFormat(filters, 'filter key')),
    });
  }

  getResourceARNs(region: string, resourceType: string, tags: MultiFilters) {
    return this.resourceRequest('resource-arns', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      resourceType: this.templateSrv.replace(resourceType),
      tags: JSON.stringify(this.convertMultiFilterFormat(tags, 'tag name')),
    });
  }
}
