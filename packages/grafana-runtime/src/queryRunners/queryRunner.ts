import { DataConfigSource, QueryRunner } from '@grafana/data';

/**
 * Used by Grafana internals to describe the factory function of creating a QueryRunner.
 *
 * @internal
 */
export type QueryRunnerFactory = (config?: DataConfigSource) => QueryRunner;

let instance: QueryRunnerFactory;

/**
 * Used by Grafana internals to set the {@link QueryRunnerFactory} to be able to create
 * QueryRunners outside of core grafana.
 *
 * @internal
 */
export const setQueryRunnerFactory = (factory: QueryRunnerFactory): void => {
  instance = factory;
};

/**
 * Use this factory function to create a query runner that can be used from plugins to run Grafana queries against
 * any of the datasource plugins installed in the current Grafana instance.
 *
 * @param config - configuration instructing the created query runner what transformations and field overrides to use.
 * @returns {QueryRunner} that can be used to run queries against supported datasources.
 */
export const createQueryRunner = (config?: DataConfigSource): QueryRunner => {
  if (!instance) {
    throw new Error('createQueryRunner can only be called after grafana instance has been started.');
  }
  return instance(config);
};
