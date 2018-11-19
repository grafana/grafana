import isString from 'lodash/isString';
import { alignmentPeriods } from './constants';
import { MetricFindQueryTypes } from './types';
import { getMetricTypesByService, getAlignmentOptionsByMetric, getAggregationOptionsByMetric } from './functions';

export default class StackdriverMetricFindQuery {
  constructor(private datasource) {}

  async execute(query: any) {
    try {
      switch (query.selectedQueryType) {
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

  async handleLabelKeysQuery({ selectedQueryType, selectedMetricType, labelKey }) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleLabelKeysQuery';
    const response = await this.datasource.getLabels(selectedMetricType, refId);
    const labelKeys = response.meta
      ? [...Object.keys(response.meta.resourceLabels), ...Object.keys(response.meta.metricLabels)]
      : [];
    return labelKeys.map(this.toFindQueryResult);
  }

  async handleLabelValuesQuery({ selectedQueryType, selectedMetricType, labelKey }) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleLabelValuesQuery';
    const response = await this.datasource.getLabels(selectedMetricType, refId);

    let values = [];
    if (response.meta && response.meta.metricLabels && response.meta.metricLabels.hasOwnProperty(labelKey)) {
      values = response.meta.metricLabels[labelKey];
    } else if (response.meta && response.meta.resourceLabels && response.meta.resourceLabels.hasOwnProperty(labelKey)) {
      values = response.meta.resourceLabels[labelKey];
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
