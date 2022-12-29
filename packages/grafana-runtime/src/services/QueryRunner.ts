import { Observable } from 'rxjs';

import { DataQueryRequest, DataSourceApi, PanelData, QueryRunner } from '@grafana/data';

let factory: QueryRunnerFactory | undefined;

/**
 * @internal
 */
export type QueryRunnerFactory = () => QueryRunner;

/**
 * Used to bootstrap the {@link createQueryRunner} during application start.
 *
 * @internal
 */
export const setQueryRunnerFactory = (instance: QueryRunnerFactory): void => {
  if (factory) {
    throw new Error('Runner should only be set when Grafana is starting.');
  }
  factory = instance;
};

/**
 * Used to create QueryRunner instances from outside the core Grafana application.
 * This is helpful to be able to create a QueryRunner to execute queries in e.g. an app plugin.
 *
 * @internal
 */
export const createQueryRunner = (): QueryRunner => {
  if (!factory) {
    throw new Error('`createQueryRunner` can only be used after Grafana instance has started.');
  }
  return factory();
};

type RunRequestFn = (
  datasource: DataSourceApi,
  request: DataQueryRequest,
  queryFunction?: typeof datasource.query
) => Observable<PanelData>;

let runRequest: RunRequestFn | undefined;

/**
 * Used to exspose runRequest implementation to libraries, i.e. @grafana/scenes
 *
 * @internal
 */
export function setRunRequest(fn: RunRequestFn): void {
  if (runRequest) {
    throw new Error('runRequest function should only be set once, when Grafana is starting.');
  }
  runRequest = fn;
}

export function getRunRequest(): RunRequestFn {
  if (!runRequest) {
    throw new Error('getRunRequest can only be used after Grafana instance has started.');
  }
  return runRequest;
}
