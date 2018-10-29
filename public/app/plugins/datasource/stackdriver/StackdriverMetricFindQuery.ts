import {
  extractServicesFromMetricDescriptors,
  getMetricTypesByService,
  getAlignmentOptionsByMetric,
} from './functions';
import { alignmentPeriods } from './constants';
import has from 'lodash/has';

export default class StackdriverMetricFindQuery {
  constructor(private datasource) {}

  async query(query: any) {
    switch (query.type) {
      case 'services':
        return this.handleServiceQueryType();
      case 'metricTypes':
        return this.handleMetricTypesQueryType(query);
      case 'metricLabels':
      case 'resourceLabels':
        return this.handleLabelQueryType(query);
      case 'resourceTypes':
        return this.handleResourceType(query);
      case 'alignerns':
        return this.handleAlignersType(query);
      case 'alignmentPeriods':
        return this.handleAlignmentPeriodType();
      default:
        return [];
    }
  }

  async handleServiceQueryType() {
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const services = extractServicesFromMetricDescriptors(metricDescriptors);
    return services.map(s => ({
      text: s.serviceShortName,
      value: s.name,
      expandable: true,
    }));
  }

  async handleMetricTypesQueryType({ service }) {
    if (!service) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    return getMetricTypesByService(metricDescriptors, service).map(s => ({
      text: s.displayName,
      value: s.name,
      expandable: true,
    }));
  }

  getLabelKey({ type, metricLabelKey, resourceLabelKey }) {
    switch (type) {
      case 'metricLabels':
        return metricLabelKey;
        break;
      case 'resourceLabels':
        return resourceLabelKey;
      default:
        return '';
    }
  }

  async handleLabelQueryType({ type, metricType, metricLabelKey, resourceLabelKey, resourceTypeKey }) {
    if (!metricType) {
      return [];
    }
    const key = this.getLabelKey({ type, metricLabelKey, resourceLabelKey });
    const refId = 'handleLabelsQueryType';
    const response = await this.datasource.getLabels(metricType, refId);
    if (!has(response, `meta.${type}.${key}`)) {
      return [];
    }
    return response.meta[type][key].map(s => ({
      text: s,
      expandable: true,
    }));
  }

  async handleResourceType({ metricType }) {
    if (!metricType) {
      return [];
    }
    try {
      const refId = 'handleResourceTypeQueryType';
      const response = await this.datasource.getLabels(metricType, refId);
      return response.meta.resourceTypes.map(s => ({
        text: s,
        expandable: true,
      }));
    } catch (error) {
      return [];
    }
  }

  async handleAlignersType({ metricType }) {
    if (!metricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const { valueType, metricKind } = metricDescriptors.find(m => m.type === metricType);
    return getAlignmentOptionsByMetric(valueType, metricKind).map(o => ({
      ...o,
      expandable: true,
    }));
  }

  handleAlignmentPeriodType() {
    return alignmentPeriods.map(s => ({
      ...s,
      expandable: true,
    }));
  }
}
