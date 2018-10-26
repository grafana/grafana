import uniqBy from 'lodash/uniqBy';

export const extractServicesFromMetricDescriptors = metricDescriptors => uniqBy(metricDescriptors, 'service');

export const getMetricTypesByService = (metricDescriptors, service) =>
  metricDescriptors.filter(m => m.service === service);
