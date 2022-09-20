import { DataSourceInstanceSettings } from '@grafana/data';
import { getBackendSrv, BackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { CloudWatchRequest } from './query-runner/CloudWatchRequest';
import { CloudWatchJsonData, Dimensions } from './types';

export class CloudWatchAPI extends CloudWatchRequest {
  private backendSrv: BackendSrv;
  constructor(instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>, templateSrv: TemplateSrv) {
    super(instanceSettings, templateSrv);
    this.backendSrv = getBackendSrv();
  }

  resourceRequest(subtype: string, parameters?: any): Promise<Array<{ text: any; label: any; value: any }>> {
    return this.backendSrv.get(`/api/datasources/${this.instanceSettings.id}/resources/${subtype}`, parameters);
  }

  getRegions(): Promise<Array<{ label: string; value: string; text: string }>> {
    return this.resourceRequest('regions').then((regions: any) => [
      { label: 'default', value: 'default', text: 'default' },
      ...regions,
    ]);
  }

  getNamespaces() {
    return this.resourceRequest('namespaces');
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

  async getAllMetrics(region: string): Promise<Array<{ metricName: string; namespace: string }>> {
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

  getEc2InstanceAttribute(region: string, attributeName: string, filters: any) {
    return this.resourceRequest('ec2-instance-attribute', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      attributeName: this.templateSrv.replace(attributeName),
      filters: JSON.stringify(this.convertMultiFilterFormat(filters, 'filter key')),
    });
  }

  getResourceARNs(region: string, resourceType: string, tags: any) {
    return this.resourceRequest('resource-arns', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      resourceType: this.templateSrv.replace(resourceType),
      tags: JSON.stringify(this.convertMultiFilterFormat(tags, 'tag name')),
    });
  }
}
