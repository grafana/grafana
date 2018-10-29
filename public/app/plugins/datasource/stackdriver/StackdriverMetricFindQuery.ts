import {
  extractServicesFromMetricDescriptors,
  getMetricTypesByService,
  getAlignmentOptionsByMetric,
  getAggregationOptionsByMetric,
} from './functions';
import { alignmentPeriods } from './constants';
import has from 'lodash/has';
import isString from 'lodash/isString';
import { MetricFindQueryTypes } from './types';

export default class StackdriverMetricFindQuery {
  constructor(private datasource) {}

  async query(query: any) {
    switch (query.type) {
      case MetricFindQueryTypes.Services:
        return this.handleServiceQuery();
      case MetricFindQueryTypes.MetricTypes:
        return this.handleMetricTypesQuery(query);
      case MetricFindQueryTypes.MetricLabels:
      case MetricFindQueryTypes.ResourceLabels:
        return this.handleLabelQuery(query);
      case MetricFindQueryTypes.ResourceTypes:
        return this.handleResourceTypeQuery(query);
      case MetricFindQueryTypes.Alignerns:
        return this.handleAlignersQuery(query);
      case MetricFindQueryTypes.AlignmentPeriods:
        return this.handleAlignmentPeriodQuery();
      case MetricFindQueryTypes.Aggregations:
        return this.handleAggregationQuery(query);
      default:
        return [];
    }
  }

  async handleServiceQuery() {
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const services = extractServicesFromMetricDescriptors(metricDescriptors);
    return services.map(s => ({
      text: s.serviceShortName,
      value: s.name,
      expandable: true,
    }));
  }

  async handleMetricTypesQuery({ service }) {
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

  async handleLabelQuery({ type, metricType, metricLabelKey, resourceLabelKey, resourceTypeKey }) {
    if (!metricType) {
      return [];
    }
    const key = this.getLabelKey({ type, metricLabelKey, resourceLabelKey });
    const refId = 'handleLabelsQueryType';
    const response = await this.datasource.getLabels(metricType, refId);
    if (!has(response, `meta.${type}.${key}`)) {
      return [];
    }
    return response.meta[type][key].map(this.toFindQueryResult);
  }

  async handleResourceTypeQuery({ metricType }) {
    if (!metricType) {
      return [];
    }
    try {
      const refId = 'handleResourceTypeQueryQueryType';
      const response = await this.datasource.getLabels(metricType, refId);
      return response.meta.resourceTypes.map(this.toFindQueryResult);
    } catch (error) {
      return [];
    }
  }

  async handleAlignersQuery({ metricType }) {
    if (!metricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const { valueType, metricKind } = metricDescriptors.find(m => m.type === metricType);
    return getAlignmentOptionsByMetric(valueType, metricKind).map(this.toFindQueryResult);
  }

  async handleAggregationQuery({ metricType }) {
    if (!metricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const { valueType, metricKind } = metricDescriptors.find(m => m.type === metricType);
    return getAggregationOptionsByMetric(valueType, metricKind).map(this.toFindQueryResult);
  }

  handleAlignmentPeriodQuery() {
    return alignmentPeriods.map(this.toFindQueryResult);
  }

  toFindQueryResult(x) {
    return isString(x) ? { text: x, expandable: true } : { ...x, expandable: true };
  }

  getLabelKey({ type, metricLabelKey, resourceLabelKey }) {
    switch (type) {
      case MetricFindQueryTypes.MetricLabels:
        return metricLabelKey;
        break;
      case MetricFindQueryTypes.ResourceLabels:
        return resourceLabelKey;
      default:
        return '';
    }
  }
}
