import { extractServicesFromMetricDescriptors, getMetricTypesByService } from './functions';
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

  async handleLabelQueryType({ type, metricType, metricLabelKey, resourceLabelKey }) {
    if (!metricType) {
      return [];
    }
    const key = type === 'metricLabels' ? metricLabelKey : resourceLabelKey;
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
}
