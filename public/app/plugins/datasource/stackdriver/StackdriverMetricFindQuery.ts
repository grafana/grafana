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
        return this.handleMetricLabelsQueryType(query);
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

  async handleMetricLabelsQueryType({ metricType, metricLabelKey }) {
    if (!metricType || !metricLabelKey) {
      return [];
    }
    const refId = 'handleMetricLabelsQueryType';
    const response = await this.datasource.getLabels(metricType, refId);
    return has(response, `meta.metricLabels.${metricLabelKey}`)
      ? response.meta.metricLabels[metricLabelKey].map(s => ({
          text: s,
          expandable: true,
        }))
      : [];
  }
}
