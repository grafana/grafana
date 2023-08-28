import { isString } from 'lodash';

import { SelectableValue } from '@grafana/data';

import { ALIGNMENT_PERIODS, SELECTORS } from './constants';
import CloudMonitoringDatasource from './datasource';
import {
  extractServicesFromMetricDescriptors,
  getAggregationOptionsByMetric,
  getAlignmentOptionsByMetric,
  getLabelKeys,
  getMetricTypesByService,
} from './functions';
import { MetricKind, ValueTypes, MetricFindQueryTypes } from './types/query';
import { CloudMonitoringVariableQuery, MetricDescriptor } from './types/types';

export default class CloudMonitoringMetricFindQuery {
  constructor(private datasource: CloudMonitoringDatasource) {}

  async execute(query: CloudMonitoringVariableQuery) {
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

  async handleServiceQuery({ projectName }: CloudMonitoringVariableQuery) {
    const metricDescriptors = await this.datasource.getMetricTypes(projectName);
    const services: MetricDescriptor[] = extractServicesFromMetricDescriptors(metricDescriptors);
    return services.map((s) => ({
      text: s.serviceShortName,
      value: s.service,
      expandable: true,
    }));
  }

  async handleMetricTypesQuery({ selectedService, projectName }: CloudMonitoringVariableQuery) {
    if (!selectedService) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(projectName);
    return getMetricTypesByService(metricDescriptors, this.datasource.templateSrv.replace(selectedService)).map(
      (s) => ({
        text: s.displayName,
        value: s.type,
        expandable: true,
      })
    );
  }

  async handleLabelKeysQuery({ selectedMetricType, projectName }: CloudMonitoringVariableQuery) {
    if (!selectedMetricType) {
      return [];
    }
    const labelKeys = await getLabelKeys(this.datasource, selectedMetricType, projectName);
    return labelKeys.map(this.toFindQueryResult);
  }

  async handleLabelValuesQuery({ selectedMetricType, labelKey, projectName }: CloudMonitoringVariableQuery) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleLabelValuesQuery';
    // REDUCE_MEAN is needed so the groupBy is not ignored
    const labels = await this.datasource.getLabels(selectedMetricType, refId, projectName, {
      groupBys: [labelKey],
      crossSeriesReducer: 'REDUCE_MEAN',
    });
    const interpolatedKey = this.datasource.templateSrv.replace(labelKey);
    const values = labels.hasOwnProperty(interpolatedKey) ? labels[interpolatedKey] : [];
    return values.map(this.toFindQueryResult);
  }

  async handleResourceTypeQuery({ selectedMetricType, projectName }: CloudMonitoringVariableQuery) {
    if (!selectedMetricType) {
      return [];
    }
    const refId = 'handleResourceTypeQueryQueryType';
    const labels = await this.datasource.getLabels(selectedMetricType, refId, projectName);
    return labels['resource.type']?.map(this.toFindQueryResult) ?? [];
  }

  async handleAlignersQuery({ selectedMetricType, projectName }: CloudMonitoringVariableQuery) {
    if (!selectedMetricType) {
      return [];
    }
    const metricDescriptors = await this.datasource.getMetricTypes(projectName);
    const descriptor = metricDescriptors.find(
      (m) => m.type === this.datasource.templateSrv.replace(selectedMetricType)
    );

    if (!descriptor) {
      return [];
    }

    return getAlignmentOptionsByMetric(descriptor.valueType, descriptor.metricKind).map(this.toFindQueryResult);
  }

  async handleAggregationQuery({ selectedMetricType, projectName }: CloudMonitoringVariableQuery) {
    if (!selectedMetricType) {
      return [];
    }

    const metricDescriptors = await this.datasource.getMetricTypes(projectName);
    const descriptor = metricDescriptors.find(
      (m) => m.type === this.datasource.templateSrv.replace(selectedMetricType)
    );

    if (!descriptor) {
      return [];
    }

    return getAggregationOptionsByMetric(descriptor.valueType as ValueTypes, descriptor.metricKind as MetricKind).map(
      this.toFindQueryResult
    );
  }

  async handleSLOServicesQuery({ projectName }: CloudMonitoringVariableQuery) {
    const services = await this.datasource.getSLOServices(projectName);
    return services.map(this.toFindQueryResult);
  }

  async handleSLOQuery({ selectedSLOService, projectName }: CloudMonitoringVariableQuery) {
    const slos = await this.datasource.getServiceLevelObjectives(projectName, selectedSLOService);
    return slos.map(this.toFindQueryResult);
  }

  async handleSelectorQuery() {
    return SELECTORS.map(this.toFindQueryResult);
  }

  handleAlignmentPeriodQuery() {
    return ALIGNMENT_PERIODS.map(this.toFindQueryResult);
  }

  toFindQueryResult(x: any) {
    return isString(x) ? { text: x, expandable: true } : { ...x, expandable: true };
  }
}
