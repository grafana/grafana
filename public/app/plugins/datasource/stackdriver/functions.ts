import { alignOptions, aggOptions } from './constants';

export const getMetricTypesByService = (metricDescriptors, service) =>
  metricDescriptors.filter(m => m.service === service);

export const getMetricTypes = (metricDescriptors, metricType, selectedService) => {
  const metricTypes = getMetricTypesByService(metricDescriptors, selectedService).map(m => ({
    value: m.type,
    name: m.displayName,
  }));
  const metricTypeExistInArray = metricTypes.some(m => m.value === metricType);
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
