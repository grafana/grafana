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
  constructor(private datasource: any) {}

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

  async handleMetricTypesQuery({ selectedService }: any) {
    if (!selectedService) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    return getMetricTypesByService(metricDescriptors, this.datasource.templateSrv.replace(selectedService)).map(
      (s: any) => ({
        text: s.displayName,
        value: s.type,
        expandable: true,
      })
    );
  }

  async handleLabelKeysQuery({ selectedMetricType }: any) {
    if (!selectedMetricType) {
      return [];
    }
    const labelKeys = await getLabelKeys(this.datasource, selectedMetricType);
    return labelKeys.map(this.toFindQueryResult);
  }

  async handleLabelValuesQuery({ selectedMetricType, labelKey }: any) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleLabelValuesQuery';
    const labels = await this.datasource.getLabels(selectedMetricType, refId, [labelKey]);
    const interpolatedKey = this.datasource.templateSrv.replace(labelKey);
    const values = labels.hasOwnProperty(interpolatedKey) ? labels[interpolatedKey] : [];
    return values.map(this.toFindQueryResult);
  }

  async handleResourceTypeQuery({ selectedMetricType }: any) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleResourceTypeQueryQueryType';
    const labels = await this.datasource.getLabels(selectedMetricType, refId);
    return labels['resource.type'].map(this.toFindQueryResult);
  }

  async handleAlignersQuery({ selectedMetricType }: any) {
    if (!selectedMetricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const { valueType, metricKind } = metricDescriptors.find(
      (m: any) => m.type === this.datasource.templateSrv.replace(selectedMetricType)
    );
    return getAlignmentOptionsByMetric(valueType, metricKind).map(this.toFindQueryResult);
  }

  async handleAggregationQuery({ selectedMetricType }: any) {
    if (!selectedMetricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(this.datasource.projectName);
    const { valueType, metricKind } = metricDescriptors.find(
      (m: any) => m.type === this.datasource.templateSrv.replace(selectedMetricType)
    );
    return getAggregationOptionsByMetric(valueType, metricKind).map(this.toFindQueryResult);
  }

  handleAlignmentPeriodQuery() {
    return alignmentPeriods.map(this.toFindQueryResult);
  }

  toFindQueryResult(x: any) {
    return isString(x) ? { text: x, expandable: true } : { ...x, expandable: true };
  }
}
