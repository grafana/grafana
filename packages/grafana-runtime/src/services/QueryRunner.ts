import { QueryRunner } from '@grafana/data';

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
