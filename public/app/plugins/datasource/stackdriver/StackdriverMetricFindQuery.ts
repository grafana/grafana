import has from 'lodash/has';
import isString from 'lodash/isString';
import { alignmentPeriods } from './constants';
import { MetricFindQueryTypes } from './types';
import { getMetricTypesByService, getAlignmentOptionsByMetric, getAggregationOptionsByMetric } from './functions';

export default class StackdriverMetricFindQuery {
  constructor(private datasource) {}

  async query(query: any) {
    try {
      switch (query.selectedQueryType) {
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
    } catch (error) {
      console.error(`Could not run StackdriverMetricFindQuery ${query}`, error);
      return [];
    }
  }

  async handleMetricTypesQuery({ selectedService }) {
    if (!selectedService) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    return getMetricTypesByService(metricDescriptors, selectedService).map(s => ({
      text: s.displayName,
      value: s.type,
      expandable: true,
    }));
  }

  async handleLabelQuery({ selectedQueryType, selectedMetricType, labelKey }) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleLabelsQueryType';
    const response = await this.datasource.getLabels(selectedMetricType, refId);
    if (!has(response, `meta.${selectedQueryType}.${labelKey}`)) {
      return [];
    }
    return response.meta[selectedQueryType][labelKey].map(this.toFindQueryResult);
  }

  async handleResourceTypeQuery({ selectedMetricType }) {
    if (!selectedMetricType) {
      return [];
    }
    try {
      const refId = 'handleResourceTypeQueryQueryType';
      const response = await this.datasource.getLabels(selectedMetricType, refId);
      return response.meta.resourceTypes.map(this.toFindQueryResult);
    } catch (error) {
      return [];
    }
  }

  async handleAlignersQuery({ selectedMetricType }) {
    if (!selectedMetricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const { valueType, metricKind } = metricDescriptors.find(m => m.type === selectedMetricType);
    return getAlignmentOptionsByMetric(valueType, metricKind).map(this.toFindQueryResult);
  }

  async handleAggregationQuery({ selectedMetricType }) {
    if (!selectedMetricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const { valueType, metricKind } = metricDescriptors.find(m => m.type === selectedMetricType);
    return getAggregationOptionsByMetric(valueType, metricKind).map(this.toFindQueryResult);
  }

  handleAlignmentPeriodQuery() {
    return alignmentPeriods.map(this.toFindQueryResult);
  }

  toFindQueryResult(x) {
    return isString(x) ? { text: x, expandable: true } : { ...x, expandable: true };
  }
}
