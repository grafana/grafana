import { chunk, initial, startCase, uniqBy } from 'lodash';

import { rangeUtil } from '@grafana/data';
import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { AGGREGATIONS, ALIGNMENTS, SYSTEM_LABELS } from './constants';
import CloudMonitoringDatasource from './datasource';
import { AlignmentTypes, PreprocessorType, TimeSeriesList, MetricKind, ValueTypes } from './types/query';
import { CustomMetaData, MetricDescriptor } from './types/types';

export const extractServicesFromMetricDescriptors = (metricDescriptors: MetricDescriptor[]) =>
  uniqBy(metricDescriptors, 'service');

export const getMetricTypesByService = (metricDescriptors: MetricDescriptor[], service: string) =>
  metricDescriptors.filter((m: MetricDescriptor) => m.service === service);

export const getMetricTypes = (
  metricDescriptors: MetricDescriptor[],
  metricType: string,
  interpolatedMetricType: string,
  selectedService: string
) => {
  const metricTypes = getMetricTypesByService(metricDescriptors, selectedService).map((m) => ({
    value: m.type,
    name: m.displayName,
  }));
  const metricTypeExistInArray = metricTypes.some(
    (m: { value: string; name: string }) => m.value === interpolatedMetricType
  );
  const metricTypeByService = metricTypes.length ? metricTypes[0].value : '';
  const selectedMetricType = metricTypeExistInArray ? metricType : metricTypeByService;
  return {
    metricTypes,
    selectedMetricType,
  };
};

export const getAlignmentOptionsByMetric = (
  metricValueType?: string,
  metricKind?: string,
  preprocessor?: PreprocessorType
) => {
  if (preprocessor && preprocessor === PreprocessorType.Rate) {
    metricKind = MetricKind.GAUGE;
  }

  return !metricValueType
    ? []
    : ALIGNMENTS.filter((i) => {
        return (
          i.valueTypes.indexOf(metricValueType as ValueTypes) !== -1 &&
          i.metricKinds.indexOf(metricKind as MetricKind) !== -1
        );
      });
};

export const getAggregationOptionsByMetric = (valueType: ValueTypes, metricKind: MetricKind) => {
  return !metricKind
    ? []
    : AGGREGATIONS.filter((i) => {
        return i.valueTypes.indexOf(valueType) !== -1 && i.metricKinds.indexOf(metricKind) !== -1;
      });
};

export const getLabelKeys = async (
  datasource: CloudMonitoringDatasource,
  selectedMetricType: string,
  projectName: string
) => {
  const refId = 'handleLabelKeysQuery';
  const labels = await datasource.getLabels(selectedMetricType, refId, projectName);
  return [...Object.keys(labels), ...SYSTEM_LABELS];
};

export const getAlignmentPickerData = (
  valueType: string | undefined = ValueTypes.DOUBLE,
  metricKind: string | undefined = MetricKind.GAUGE,
  perSeriesAligner: string | undefined = AlignmentTypes.ALIGN_MEAN,
  preprocessor?: PreprocessorType
) => {
  const templateSrv: TemplateSrv = getTemplateSrv();
  const alignOptions = getAlignmentOptionsByMetric(valueType, metricKind, preprocessor).map((option) => ({
    ...option,
    label: option.text,
  }));
  if (!alignOptions.some((o: { value: string }) => o.value === templateSrv.replace(perSeriesAligner))) {
    perSeriesAligner = alignOptions.length > 0 ? alignOptions[0].value : AlignmentTypes.ALIGN_MEAN;
  }
  return { alignOptions, perSeriesAligner };
};

export const labelsToGroupedOptions = (groupBys: string[]) => {
  const groups = groupBys.reduce<
    Record<
      string,
      Array<{
        value: string;
        label: string;
      }>
    >
  >((acc, curr) => {
    const arr = curr.split('.').map(startCase);
    const group = (arr.length === 2 ? arr : initial(arr)).join(' ');
    const option = {
      value: curr,
      label: curr,
    };
    if (acc[group]) {
      acc[group] = [...acc[group], option];
    } else {
      acc[group] = [option];
    }
    return acc;
  }, {});
  return Object.entries(groups).map(([label, options]) => ({ label, options, expanded: true }), []);
};

export const stringArrayToFilters = (filterArray: string[]) =>
  chunk(filterArray, 4).map(([key, operator, value, condition = 'AND']) => ({
    key,
    operator,
    value,
    condition,
  }));

export const alignmentPeriodLabel = (customMetaData: CustomMetaData, datasource: CloudMonitoringDatasource) => {
  const { perSeriesAligner, alignmentPeriod } = customMetaData;
  if (!alignmentPeriod || !perSeriesAligner) {
    return '';
  }

  const alignment = ALIGNMENTS.find((ap) => ap.value === datasource.templateSrv.replace(perSeriesAligner));
  const seconds = parseInt(alignmentPeriod, 10);
  const hms = rangeUtil.secondsToHms(seconds);
  return `${hms} interval (${alignment?.text ?? ''})`;
};

export const getMetricType = (query?: TimeSeriesList) => {
  const metricTypeKey = query?.filters?.findIndex((f) => f === 'metric.type')!;
  // filters are in the format [key, operator, value] so we need to add 2 to get the value
  const metricType = query?.filters?.[metricTypeKey + 2];
  return metricType || '';
};

export const setMetricType = (query: TimeSeriesList, metricType: string) => {
  if (!query.filters) {
    query.filters = ['metric.type', '=', metricType];
    return query;
  }
  const metricTypeKey = query?.filters?.findIndex((f) => f === 'metric.type')!;
  if (metricTypeKey === -1) {
    query.filters.push('metric.type', '=', metricType);
  } else {
    // filters are in the format [key, operator, value] so we need to add 2 to get the value
    query.filters![metricTypeKey + 2] = metricType;
  }
  return query;
};
