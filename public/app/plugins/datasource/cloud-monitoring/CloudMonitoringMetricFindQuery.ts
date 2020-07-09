import isString from 'lodash/isString';
import { alignmentPeriods, ValueTypes, MetricKind, selectors } from './constants';
import CloudMonitoringDatasource from './datasource';
import { MetricFindQueryTypes, VariableQueryData } from './types';
import { SelectableValue } from '@grafana/data';
import {
  getMetricTypesByService,
  getAlignmentOptionsByMetric,
  getAggregationOptionsByMetric,
  extractServicesFromMetricDescriptors,
  getLabelKeys,
} from './functions';

export default class CloudMonitoringMetricFindQuery {
  constructor(private datasource: CloudMonitoringDatasource) {}

  async execute(query: VariableQueryData) {
    try {
      if (!query.projectName) {
        query.projectName = this.datasource.getDefaultProject();
      }

      switch (query.selectedQueryType) {
        case MetricFindQueryTypes.Projects:
          return this.handleProjectsQuery();
        case MetricFindQueryTypes.Services:
          return this.handleServiceQuery(query);
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
        case MetricFindQueryTypes.SLOServices:
          return this.handleSLOServicesQuery(query);
        case MetricFindQueryTypes.SLO:
          return this.handleSLOQuery(query);
        case MetricFindQueryTypes.Selectors:
          return this.handleSelectorQuery();
        default:
          return [];
      }
    } catch (error) {
      console.error(`Could not run CloudMonitoringMetricFindQuery ${query}`, error);
      return [];
    }
  }

  async handleProjectsQuery() {
    const projects = await this.datasource.getProjects();
    return (projects as SelectableValue<string>).map((s: { label: string; value: string }) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleServiceQuery({ projectName }: VariableQueryData) {
    const metricDescriptors = await this.datasource.getMetricTypes(projectName);
    const services: any[] = extractServicesFromMetricDescriptors(metricDescriptors);
    return services.map(s => ({
      text: s.serviceShortName,
      value: s.service,
      expandable: true,
    }));
  }

  async handleMetricTypesQuery({ selectedService, projectName }: VariableQueryData) {
    if (!selectedService) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(projectName);
    return getMetricTypesByService(metricDescriptors, this.datasource.templateSrv.replace(selectedService)).map(
      (s: any) => ({
        text: s.displayName,
        value: s.type,
        expandable: true,
      })
    );
  }

  async handleLabelKeysQuery({ selectedMetricType, projectName }: VariableQueryData) {
    if (!selectedMetricType) {
      return [];
    }
    const labelKeys = await getLabelKeys(this.datasource, selectedMetricType, projectName);
    return labelKeys.map(this.toFindQueryResult);
  }

  async handleLabelValuesQuery({ selectedMetricType, labelKey, projectName }: VariableQueryData) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleLabelValuesQuery';
    const labels = await this.datasource.getLabels(selectedMetricType, refId, projectName, [labelKey]);
    const interpolatedKey = this.datasource.templateSrv.replace(labelKey);
    const values = labels.hasOwnProperty(interpolatedKey) ? labels[interpolatedKey] : [];
    return values.map(this.toFindQueryResult);
  }

  async handleResourceTypeQuery({ selectedMetricType, projectName }: VariableQueryData) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleResourceTypeQueryQueryType';
    const labels = await this.datasource.getLabels(selectedMetricType, refId, projectName);
    return labels['resource.type'].map(this.toFindQueryResult);
  }

  async handleAlignersQuery({ selectedMetricType, projectName }: VariableQueryData) {
    if (!selectedMetricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(projectName);
    const descriptor = metricDescriptors.find(
      (m: any) => m.type === this.datasource.templateSrv.replace(selectedMetricType)
    );

    if (!descriptor) {
      return [];
    }

    return getAlignmentOptionsByMetric(descriptor.valueType, descriptor.metricKind).map(this.toFindQueryResult);
  }

  async handleAggregationQuery({ selectedMetricType, projectName }: VariableQueryData) {
    if (!selectedMetricType) {
      return [];
    }

    const metricDescriptors = await this.datasource.getMetricTypes(projectName);
    const descriptor = metricDescriptors.find(
      (m: any) => m.type === this.datasource.templateSrv.replace(selectedMetricType)
    );

    if (!descriptor) {
      return [];
    }

    return getAggregationOptionsByMetric(descriptor.valueType as ValueTypes, descriptor.metricKind as MetricKind).map(
      this.toFindQueryResult
    );
  }

  async handleSLOServicesQuery({ projectName }: VariableQueryData) {
    const services = await this.datasource.getSLOServices(projectName);
    return services.map(this.toFindQueryResult);
  }

  async handleSLOQuery({ selectedSLOService, projectName }: VariableQueryData) {
    const slos = await this.datasource.getServiceLevelObjectives(projectName, selectedSLOService);
    return slos.map(this.toFindQueryResult);
  }

  async handleSelectorQuery() {
    return selectors.map(this.toFindQueryResult);
  }

  handleAlignmentPeriodQuery() {
    return alignmentPeriods.map(this.toFindQueryResult);
  }

  toFindQueryResult(x: any) {
    return isString(x) ? { text: x, expandable: true } : { ...x, expandable: true };
  }
}
