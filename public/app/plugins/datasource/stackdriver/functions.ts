import uniqBy from 'lodash/uniqBy';
import { alignOptions, aggOptions } from './constants';

export const extractServicesFromMetricDescriptors = metricDescriptors => uniqBy(metricDescriptors, 'service');

export const getMetricTypesByService = (metricDescriptors, service) =>
  metricDescriptors.filter(m => m.service === service);

export const getMetricTypes = (metricDescriptors, metricType, interpolatedMetricType, selectedService) => {
  const metricTypes = getMetricTypesByService(metricDescriptors, selectedService).map(m => ({
    value: m.type,
    name: m.displayName,
  }));
  const metricTypeExistInArray = metricTypes.some(m => m.value === interpolatedMetricType);
  const selectedMetricType = metricTypeExistInArray ? metricType : metricTypes[0].value;
  return {
    metricTypes,
    selectedMetricType,
  };
};

export const getAlignmentOptionsByMetric = (metricValueType, metricKind) => {
  return !metricValueType
    ? []
    : alignOptions.filter(i => {
        return i.valueTypes.indexOf(metricValueType) !== -1 && i.metricKinds.indexOf(metricKind) !== -1;
      });
};

export const getAggregationOptionsByMetric = (valueType, metricKind) => {
  return !metricKind
    ? []
    : aggOptions.filter(i => {
        return i.valueTypes.indexOf(valueType) !== -1 && i.metricKinds.indexOf(metricKind) !== -1;
      });
};

export const getLabelKeys = async (datasource, selectedMetricType) => {
  const refId = 'handleLabelKeysQuery';
  const response = await datasource.getLabels(selectedMetricType, refId);
  const labelKeys = response.meta
    ? [
        ...Object.keys(response.meta.resourceLabels).map(l => `resource.label.${l}`),
        ...Object.keys(response.meta.metricLabels).map(l => `metric.label.${l}`),
      ]
    : [];
  return labelKeys;
};
