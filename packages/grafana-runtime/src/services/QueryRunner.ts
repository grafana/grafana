import { QueryRunner } from '@grafana/data';

let factory: QueryRunnerFactory | undefined;

export type QueryRunnerFactory = () => QueryRunner;

export const setQueryRunnerFactory = (instance: QueryRunnerFactory): void => {
  if (factory) {
    throw new Error('Runner should only be set when Grafana is starting.');
  }
  factory = instance;
};

export const createQueryRunner = (): QueryRunner => {
  if (!factory) {
    throw new Error('`createQueryRunner` can only be used after Grafana instance has started.');
  }
  return factory();
};
