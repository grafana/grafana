/* API object types */
export type * as GrafanaAPI from './grafana/api';
export type * as PrometheusAPI from './prometheus/api';
export type * as API from './common/api';

export type * from './common/rules'; // we can't export only types because it contains enums
