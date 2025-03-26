import * as PrometheusAPI from './types/prometheus/rules/api.mocks';
import * as PrometheusDefinition from './types/prometheus/rules/definitions.mocks';

export default {
  prometheusMocks: {
    api: PrometheusAPI,
    definitions: PrometheusDefinition,
  },
  grafanaMocks: {},
};
