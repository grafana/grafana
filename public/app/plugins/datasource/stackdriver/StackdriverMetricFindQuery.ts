import isString from 'lodash/isString';
import { alignmentPeriods } from './constants';
import { MetricFindQueryTypes } from './types';
import {
  getMetricTypesByService,
  getAlignmentOptionsByMetric,
  getAggregationOptionsByMetric,
  extractServicesFromMetricDescriptors,
  getLabelKeys,
} from './functions';

export default class StackdriverMetricFindQuery {
  constructor(private datasource) {}

  async execute(query: any) {
    try {
      switch (query.selectedQueryType) {
        case MetricFindQueryTypes.Services:
          return this.handleServiceQuery();
        case MetricFindQueryTypes.MetricTypes:
          return this.handleMetricTypesQuery(query);
        case MetricFindQueryTypes.LabelKeys:
          return this.handleLabelKeysQuery(query);
        case MetricFindQueryTypes.LabelValues:
          return this.handleLabelValuesQuery(query);
        case MetricFindQueryTypes.ResourceTypes:
          return this.handleResourceTypeQuery(query);
        case MetricFindQueryTypes.Aligners:
          return this.handleAlignersQuery(query);
        case MetricFindQueryTypes.AlignmentPeriods:
          return this.handleAlignmentPeriodQuery();
        case MetricFindQueryTypes.Aggregations:
          return this.handleAggregationQuery(query);
        default:
          return [];
      }
    } catch (error) {
      console.error(`Could not run StackdriverMetricFindQuery ${query}`, error);
      return [];
    }
  }

  async handleServiceQuery() {
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const services: any[] = extractServicesFromMetricDescriptors(metricDescriptors);
    return services.map(s => ({
      text: s.serviceShortName,
      value: s.service,
      expandable: true,
    }));
  }

  async handleMetricTypesQuery({ selectedService }) {
    if (!selectedService) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    return getMetricTypesByService(metricDescriptors, this.datasource.templateSrv.replace(selectedService)).map(s => ({
      text: s.displayName,
      value: s.type,
      expandable: true,
    }));
  }

  async handleLabelKeysQuery({ selectedMetricType }) {
    if (!selectedMetricType) {
      return [];
    }
    const labelKeys = await getLabelKeys(this.datasource, selectedMetricType);
    return labelKeys.map(this.toFindQueryResult);
  }

  async handleLabelValuesQuery({ selectedMetricType, labelKey }) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleLabelValuesQuery';
    const response = await this.datasource.getLabels(selectedMetricType, refId);
    const interpolatedKey = this.datasource.templateSrv.replace(labelKey);
    const [name] = interpolatedKey.split('.').reverse();
    let values = [];
    if (response.meta && response.meta.metricLabels && response.meta.metricLabels.hasOwnProperty(name)) {
      values = response.meta.metricLabels[name];
    } else if (response.meta && response.meta.resourceLabels && response.meta.resourceLabels.hasOwnProperty(name)) {
      values = response.meta.resourceLabels[name];
    }

    return values.map(this.toFindQueryResult);
  }

  async handleResourceTypeQuery({ selectedMetricType }) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleResourceTypeQueryQueryType';
    const response = await this.datasource.getLabels(selectedMetricType, refId);
    return response.meta.resourceTypes ? response.meta.resourceTypes.map(this.toFindQueryResult) : [];
  }

  async handleAlignersQuery({ selectedMetricType }) {
    if (!selectedMetricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const { valueType, metricKind } = metricDescriptors.find(
      m => m.type === this.datasource.templateSrv.replace(selectedMetricType)
    );
    return getAlignmentOptionsByMetric(valueType, metricKind).map(this.toFindQueryResult);
  }

  async handleAggregationQuery({ selectedMetricType }) {
    if (!selectedMetricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const { valueType, metricKind } = metricDescriptors.find(
      m => m.type === this.datasource.templateSrv.replace(selectedMetricType)
    );
    return getAggregationOptionsByMetric(valueType, metricKind).map(this.toFindQueryResult);
  }

  handleAlignmentPeriodQuery() {
    return alignmentPeriods.map(this.toFindQueryResult);
  }

  toFindQueryResult(x) {
    return isString(x) ? { text: x, expandable: true } : { ...x, expandable: true };
  }
}
