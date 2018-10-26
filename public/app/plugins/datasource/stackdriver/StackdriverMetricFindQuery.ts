import { extractServicesFromMetricDescriptors, getMetricTypesByService } from './functions';

export default class StackdriverMetricFindQuery {
  constructor(private datasource) {}

  async query(query: any) {
    switch (query.type) {
      case 'services':
        return this.handleServiceQueryType();
      case 'metricTypes':
        return this.handleMetricTypesQueryType(query);
      default:
        return [];
    }
  }

  async handleServiceQueryType() {
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const services = extractServicesFromMetricDescriptors(metricDescriptors);
    return services.map(s => ({
      text: s.name,
      expandable: true,
    }));
  }

  async handleMetricTypesQueryType({ service }) {
    if (!service) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    return getMetricTypesByService(metricDescriptors, service).map(s => ({
      text: s.name,
      expandable: true,
    }));
  }
}
